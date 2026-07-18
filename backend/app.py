import os
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

# Import CrewAI orchestration components
from crewai import Crew
from agents import interface_agent, sql_agent, alerts_agent, analysis_agent, command_agent
from tasks import sql_query_task, alerts_task, analysis_task, interface_task, command_task

app = FastAPI(title="Automatix Inventory API", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual frontend URL (e.g. http://localhost:3000)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "inventory.db")

class RuleUpdate(BaseModel):
    key: str
    value: str

class StockTransfer(BaseModel):
    from_store_id: int
    to_store_id: int
    product_id: int
    quantity: int

class AuditRequest(BaseModel):
    custom_query: str = None

class CommandRequest(BaseModel):
    command: str

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/api/inventory")
def get_inventory():
    """Retrieves all branches, inventory, connections, and sales info from SQLite."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Fetch Stores
        cursor.execute("SELECT id, name, location FROM stores")
        stores = [dict(row) for row in cursor.fetchall()]

        # 2. Fetch Connections
        cursor.execute("""
            SELECT s1.name as from_store_name, s2.name as to_store_name, c.from_store_id, c.to_store_id, c.distance_km 
            FROM store_connections c
            JOIN stores s1 ON s1.id = c.from_store_id
            JOIN stores s2 ON s2.id = c.to_store_id
        """)
        connections = [dict(row) for row in cursor.fetchall()]

        # 3. Fetch Products and Store Inventory
        cursor.execute("""
            SELECT i.store_id, s.name as store_name, i.product_id, p.name as product_name, 
                   p.category, i.stock_level, i.reorder_threshold, i.expiry_date, p.price_aed
            FROM store_inventory i
            JOIN stores s ON s.id = i.store_id
            JOIN products p ON p.id = i.product_id
        """)
        inventory = [dict(row) for row in cursor.fetchall()]

        # 4. Fetch Rules
        cursor.execute("SELECT key, value, description FROM business_rules")
        rules = {row['key']: row['value'] for row in cursor.fetchall()}

        conn.close()

        return {
            "stores": stores,
            "connections": connections,
            "inventory": inventory,
            "rules": rules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@app.get("/api/rules")
def get_rules():
    """Retrieves current business rules."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT key, value, description FROM business_rules")
        rules = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return rules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rules")
def update_rule(rule: RuleUpdate):
    """Updates a business rule key-value pair in SQLite."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE business_rules SET value = ? WHERE key = ?",
            (rule.value, rule.key)
        )
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Rule key not found.")
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Rule '{rule.key}' updated to '{rule.value}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transfer")
def execute_transfer(transfer: StockTransfer):
    """Executes a stock transfer between branches, modifying SQLite records in a transaction."""
    if transfer.quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be greater than zero.")
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check source inventory level
        cursor.execute(
            "SELECT stock_level FROM store_inventory WHERE store_id = ? AND product_id = ?",
            (transfer.from_store_id, transfer.product_id)
        )
        source_row = cursor.fetchone()
        if not source_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Product not found in source store.")

        source_stock = source_row['stock_level']
        if source_stock < transfer.quantity:
            conn.close()
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock in source branch. Available: {source_stock}, Requested: {transfer.quantity}"
            )

        # Execute subtraction from source
        cursor.execute(
            "UPDATE store_inventory SET stock_level = stock_level - ? WHERE store_id = ? AND product_id = ?",
            (transfer.quantity, transfer.from_store_id, transfer.product_id)
        )

        # Check if destination record exists, if not create one or raise error. 
        cursor.execute(
            "SELECT stock_level FROM store_inventory WHERE store_id = ? AND product_id = ?",
            (transfer.to_store_id, transfer.product_id)
        )
        dest_row = cursor.fetchone()
        
        if dest_row is not None:
            # Update existing
            cursor.execute(
                "UPDATE store_inventory SET stock_level = stock_level + ? WHERE store_id = ? AND product_id = ?",
                (transfer.quantity, transfer.to_store_id, transfer.product_id)
            )
        else:
            # We insert a new record, defaulting reorder threshold to 10 and expiry date to a standard offset.
            # However, in our seed database all products exist in all stores.
            cursor.execute(
                "INSERT INTO store_inventory (store_id, product_id, stock_level, reorder_threshold, expiry_date) VALUES (?, ?, ?, 10, '2026-07-25')",
                (transfer.to_store_id, transfer.product_id, transfer.quantity)
            )

        conn.commit()
        conn.close()

        return {
            "status": "success", 
            "message": f"Successfully transferred {transfer.quantity} units of product ID {transfer.product_id} from store {transfer.from_store_id} to store {transfer.to_store_id}."
        }
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/run-audit")
def run_audit(req: AuditRequest):
    """Executes the CrewAI squad audit and returns the final markdown report."""
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    if not openai_api_key or openai_api_key == "your_openai_api_key_here":
        raise HTTPException(
            status_code=400, 
            detail="OpenAI API Key is not configured. Please set a valid OPENAI_API_KEY in the backend/.env file."
        )

    # Base query instruction
    query_str = req.custom_query if req.custom_query else (
        "Perform a comprehensive review of our multi-store UAE inventory. "
        "Scan for low stock (at or below threshold) or near-expiry items across all branches. "
        "Determine if low stock can be resolved using inter-branch transfers based on connection distances and "
        "allowable transfer configurations. If transfers aren't feasible, recommend external supplier orders using "
        "the appropriate reorder multipliers, and suggest promotions for near-expiry products."
    )

    try:
        # Assemble the Crew
        inventory_crew = Crew(
            agents=[interface_agent, sql_agent, alerts_agent, analysis_agent],
            tasks=[sql_query_task, alerts_task, analysis_task, interface_task],
            verbose=True
        )

        # Kickoff the crew execution
        result = inventory_crew.kickoff(inputs={"query": query_str})
        raw_result = getattr(result, 'raw', str(result))
        
        # Save output to report.md
        report_path = os.path.join(os.path.dirname(__file__), "report.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(raw_result)

        return {
            "status": "success",
            "report": raw_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent audit failed: {str(e)}")

@app.post("/api/run-command")
def run_command(req: CommandRequest):
    """Executes the database administrator agent squad to run natural language database modifications."""
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    if not openai_api_key or openai_api_key == "your_openai_api_key_here":
        raise HTTPException(
            status_code=400, 
            detail="OpenAI API Key is not configured. Please set a valid OPENAI_API_KEY in the backend/.env file."
        )

    try:
        # Assemble the Crew for execution
        command_crew = Crew(
            agents=[command_agent],
            tasks=[command_task],
            verbose=True
        )

        # Kickoff command execution
        result = command_crew.kickoff(inputs={"command": req.command})
        raw_result = getattr(result, 'raw', str(result))
        
        return {
            "status": "success",
            "result": raw_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent command execution failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
