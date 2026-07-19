import os
import random
import sqlite3
import threading
import time
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

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

def run_inventory_audit():
    """Background loop that evaluates stock levels and expiry dates every 15 seconds."""
    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # 1. Fetch rules
            cursor.execute("SELECT key, value FROM business_rules")
            rules = {row['key']: row['value'] for row in cursor.fetchall()}
            near_expiry_days = int(rules.get('near_expiry_days_threshold', 3))
            
            # 2. Get low-stock items
            cursor.execute("""
                SELECT si.store_id, si.product_id, p.name as product_name, s.name as store_name, si.stock_level, si.reorder_threshold
                FROM store_inventory si
                JOIN products p ON si.product_id = p.id
                JOIN stores s ON si.store_id = s.id
                WHERE si.stock_level < si.reorder_threshold
            """)
            low_stock_items = cursor.fetchall()
            
            # 3. Get near-expiry items
            # System date is simulated as '2026-07-16' in this codebase
            cursor.execute("""
                SELECT si.store_id, si.product_id, p.name as product_name, s.name as store_name, si.expiry_date
                FROM store_inventory si
                JOIN products p ON si.product_id = p.id
                JOIN stores s ON si.store_id = s.id
            """)
            all_items = cursor.fetchall()
            
            near_expiry_items = []
            system_date = datetime.strptime("2026-07-16", "%Y-%m-%d")
            for item in all_items:
                try:
                    expiry_date = datetime.strptime(item['expiry_date'], "%Y-%m-%d")
                    days_diff = (expiry_date - system_date).days
                    if 0 <= days_diff <= near_expiry_days:
                        near_expiry_items.append(item)
                except Exception:
                    continue
            
            # 4. Get currently dismissed alert keys so we don't recreate them immediately
            cursor.execute("SELECT store_id, product_id, alert_type FROM inventory_alerts WHERE status = 'dismissed'")
            dismissed = {(row['store_id'], row['product_id'], row['alert_type']) for row in cursor.fetchall()}
            
            # 5. Clear all 'active' alerts
            cursor.execute("DELETE FROM inventory_alerts WHERE status = 'active'")
            
            # 6. Insert new active alerts (if they weren't dismissed previously)
            for item in low_stock_items:
                key = (item['store_id'], item['product_id'], 'low_stock')
                if key not in dismissed:
                    msg = f"Low Stock: {item['product_name']} has only {item['stock_level']} left at {item['store_name']} (Threshold: {item['reorder_threshold']})."
                    cursor.execute(
                        "INSERT INTO inventory_alerts (product_id, store_id, alert_type, message, status) VALUES (?, ?, ?, ?, ?)",
                        (item['product_id'], item['store_id'], 'low_stock', msg, 'active')
                    )
                    
            for item in near_expiry_items:
                key = (item['store_id'], item['product_id'], 'near_expiry')
                if key not in dismissed:
                    msg = f"Near Expiry: {item['product_name']} expires on {item['expiry_date']} at {item['store_name']}."
                    cursor.execute(
                        "INSERT INTO inventory_alerts (product_id, store_id, alert_type, message, status) VALUES (?, ?, ?, ?, ?)",
                        (item['product_id'], item['store_id'], 'near_expiry', msg, 'active')
                    )
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error in background inventory audit: {e}")
            
        time.sleep(15)

@app.on_event("startup")
def startup_event():
    # Create inventory_alerts table if not exists
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS inventory_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            store_id INTEGER,
            alert_type TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active'
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transfer_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_store_id INTEGER,
            to_store_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            status TEXT DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(from_store_id) REFERENCES stores(id),
            FOREIGN KEY(to_store_id) REFERENCES stores(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number TEXT,
            store_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            unit_price_aed REAL,
            total_cost_aed REAL,
            sender_phone TEXT,
            receiver_phone TEXT,
            status TEXT DEFAULT 'Pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(store_id) REFERENCES stores(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    """)
    # Seed default WhatsApp numbers in business_rules if missing
    cursor.execute("INSERT OR IGNORE INTO business_rules (key, value) VALUES ('sender_whatsapp', '+971501234567')")
    cursor.execute("INSERT OR IGNORE INTO business_rules (key, value) VALUES ('receiver_whatsapp', '+971509876543')")
    conn.commit()
    conn.close()
    
    # Start background thread
    audit_thread = threading.Thread(target=run_inventory_audit, daemon=True)
    audit_thread.start()

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

class TransferStatusUpdate(BaseModel):
    request_id: int
    status: str

class POCreateRequest(BaseModel):
    store_id: int
    product_id: int
    quantity: int
    unit_price_aed: Optional[float] = 0.0
    total_cost_aed: Optional[float] = 0.0
    sender_phone: Optional[str] = ""
    receiver_phone: Optional[str] = ""
    custom_message: Optional[str] = None

class POStatusUpdate(BaseModel):
    po_id: int
    status: str

class LoginRequest(BaseModel):
    branch: str
    password: str

BRANCH_CREDENTIALS = {
    "HQ": "inventorymanagerHQ",
    "Dubai": "inventorymanagerMARINA",
    "Downtown": "inventorymanagerDOWNTOWN",
    "Sharjah": "inventorymanagerSHARJAH",
}

class InventoryUpdate(BaseModel):
    store_id: int
    product_id: int
    stock_level: int
    reorder_threshold: int
    expiry_date: str

class InventoryAdd(BaseModel):
    product_name: str
    category: str
    price_aed: float
    store_id: int
    stock_level: int
    reorder_threshold: int
    expiry_date: str

class InventoryDelete(BaseModel):
    store_id: int
    product_id: int

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.post("/api/login")
def login(req: LoginRequest):
    """Validates branch credentials and returns role info."""
    expected = BRANCH_CREDENTIALS.get(req.branch)
    if not expected or req.password != expected:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    
    store_id_map = {"HQ": None, "Dubai": 1, "Downtown": 2, "Sharjah": 3}
    return {
        "status": "success",
        "role": req.branch,
        "store_id": store_id_map.get(req.branch),
    }

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

@app.put("/api/inventory/update")
def update_inventory_item(item: InventoryUpdate):
    """Updates an existing inventory item in the store_inventory table."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if record exists
        cursor.execute(
            "SELECT * FROM store_inventory WHERE store_id = ? AND product_id = ?",
            (item.store_id, item.product_id)
        )
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Inventory record not found.")

        # Update
        cursor.execute(
            """
            UPDATE store_inventory 
            SET stock_level = ?, reorder_threshold = ?, expiry_date = ? 
            WHERE store_id = ? AND product_id = ?
            """,
            (item.stock_level, item.reorder_threshold, item.expiry_date, item.store_id, item.product_id)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Inventory level updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/inventory/add")
def add_inventory_item(item: InventoryAdd):
    """Adds a product (inserts into products if new) and adds it to the store inventory."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Check if product already exists (case-insensitive check)
        cursor.execute(
            "SELECT id FROM products WHERE LOWER(name) = LOWER(?)",
            (item.product_name.strip(),)
        )
        row = cursor.fetchone()
        if row:
            product_id = row['id']
        else:
            # Insert product
            cursor.execute(
                "INSERT INTO products (name, category, price_aed) VALUES (?, ?, ?)",
                (item.product_name.strip(), item.category.strip(), item.price_aed)
            )
            product_id = cursor.lastrowid
            
        # 2. Add or update store inventory entry
        cursor.execute(
            "SELECT * FROM store_inventory WHERE store_id = ? AND product_id = ?",
            (item.store_id, product_id)
        )
        inv_row = cursor.fetchone()
        if inv_row:
            # Update existing
            cursor.execute(
                """
                UPDATE store_inventory 
                SET stock_level = stock_level + ?, reorder_threshold = ?, expiry_date = ? 
                WHERE store_id = ? AND product_id = ?
                """,
                (item.stock_level, item.reorder_threshold, item.expiry_date, item.store_id, product_id)
            )
        else:
            # Insert new store inventory item
            cursor.execute(
                """
                INSERT INTO store_inventory (store_id, product_id, stock_level, reorder_threshold, expiry_date)
                VALUES (?, ?, ?, ?, ?)
                """,
                (item.store_id, product_id, item.stock_level, item.reorder_threshold, item.expiry_date)
            )
            
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Product successfully added/updated in branch inventory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/inventory/delete")
def delete_inventory_item(item: InventoryDelete):
    """Deletes an item from the store_inventory table for a specific store."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "DELETE FROM store_inventory WHERE store_id = ? AND product_id = ?",
            (item.store_id, item.product_id)
        )
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Product removed from branch inventory successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alerts")
def get_active_alerts():
    """Retrieves all active alerts from the inventory_alerts table."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ia.id, ia.alert_type, ia.message, ia.created_at, ia.store_id, ia.product_id, s.name as store_name
            FROM inventory_alerts ia
            LEFT JOIN stores s ON ia.store_id = s.id
            WHERE ia.status = 'active'
            ORDER BY ia.created_at DESC
        """)
        alerts = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"status": "success", "alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alerts/dismiss/{alert_id}")
def dismiss_alert(alert_id: int):
    """Marks an alert as dismissed so it won't be shown anymore."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE inventory_alerts SET status = 'dismissed' WHERE id = ?",
            (alert_id,)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Alert {alert_id} marked as dismissed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transfers")
def get_transfers():
    """Retrieves all transfer requests joined with store and product names."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT tr.id, tr.from_store_id, tr.to_store_id, tr.product_id, tr.quantity, tr.status, tr.created_at,
                   sf.name as from_store_name, st.name as to_store_name, p.name as product_name
            FROM transfer_requests tr
            JOIN stores sf ON tr.from_store_id = sf.id
            JOIN stores st ON tr.to_store_id = st.id
            JOIN products p ON tr.product_id = p.id
            ORDER BY tr.created_at DESC
        """)
        transfers = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"status": "success", "transfers": transfers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transfers/create")
def create_transfer_request(transfer: StockTransfer):
    """Logs a new transfer request in Pending state."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO transfer_requests (from_store_id, to_store_id, product_id, quantity, status)
            VALUES (?, ?, ?, ?, 'Pending')
            """,
            (transfer.from_store_id, transfer.to_store_id, transfer.product_id, transfer.quantity)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Transfer request created in status Pending."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transfers/update-status")
def update_transfer_status(req: TransferStatusUpdate):
    """Updates status. If Completed, updates stock inventory levels in SQLite."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM transfer_requests WHERE id = ?",
            (req.request_id,)
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Transfer request not found.")
            
        transfer = dict(row)
        
        if req.status == 'Sent':
            # Deduct from source store inventory immediately when shipped/dispatched
            cursor.execute(
                "UPDATE store_inventory SET stock_level = stock_level - ? WHERE store_id = ? AND product_id = ?",
                (transfer['quantity'], transfer['from_store_id'], transfer['product_id'])
            )
        elif req.status == 'Completed':
            # Add to destination store inventory only when received/completed
            cursor.execute(
                "UPDATE store_inventory SET stock_level = stock_level + ? WHERE store_id = ? AND product_id = ?",
                (transfer['quantity'], transfer['to_store_id'], transfer['product_id'])
            )
        elif req.status == 'Cancelled':
            # If the transfer was already shipped (Sent) and gets cancelled, return stock to the source store
            if transfer['status'] == 'Sent':
                cursor.execute(
                    "UPDATE store_inventory SET stock_level = stock_level + ? WHERE store_id = ? AND product_id = ?",
                    (transfer['quantity'], transfer['from_store_id'], transfer['product_id'])
                )
            
            # Fetch names for cancellation notification message
            cursor.execute("SELECT name FROM stores WHERE id = ?", (transfer['from_store_id'],))
            from_row = cursor.fetchone()
            from_name = from_row['name'] if from_row else f"Store #{transfer['from_store_id']}"

            cursor.execute("SELECT name FROM products WHERE id = ?", (transfer['product_id'],))
            p_row = cursor.fetchone()
            p_name = p_row['name'] if p_row else f"Product #{transfer['product_id']}"

            # Post notification alert to destination store (branch in deficit)
            cursor.execute("""
                INSERT INTO inventory_alerts (product_id, store_id, alert_type, message, status)
                VALUES (?, ?, 'low_stock', ?, 'active')
            """, (
                transfer['product_id'],
                transfer['to_store_id'],
                f"Transfer Cancelled: {from_name} cancelled stock transfer of {transfer['quantity']} units of {p_name}."
            ))
        
        cursor.execute(
            "UPDATE transfer_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (req.status, req.request_id)
        )
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Transfer status updated to {req.status} successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/purchase-orders")
def get_purchase_orders():
    """Retrieves all purchase orders joined with store and product names."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT po.id, po.po_number, po.store_id, po.product_id, po.quantity,
                   po.unit_price_aed, po.total_cost_aed, po.sender_phone, po.receiver_phone,
                   po.status, po.created_at, po.updated_at,
                   s.name as store_name, p.name as product_name, p.category
            FROM purchase_orders po
            JOIN stores s ON po.store_id = s.id
            JOIN products p ON po.product_id = p.id
            ORDER BY po.created_at DESC
        """)
        orders = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"status": "success", "orders": orders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/purchase-orders/create")
def create_purchase_order(req: POCreateRequest):
    """Logs a draft Purchase Order in Pending status."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Generate PO reference number
        po_number = f"PO-{datetime.now().strftime('%Y%m%d')}-{random.randint(100, 999)}"
        
        cursor.execute("""
            INSERT INTO purchase_orders (po_number, store_id, product_id, quantity, unit_price_aed, total_cost_aed, sender_phone, receiver_phone, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        """, (po_number, req.store_id, req.product_id, req.quantity, req.unit_price_aed, req.total_cost_aed, req.sender_phone, req.receiver_phone))
        
        po_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"status": "success", "po_number": po_number, "po_id": po_id, "message": f"Draft PO {po_number} logged in Pending status."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/purchase-orders/update-status")
def update_purchase_order_status(req: POStatusUpdate):
    """Updates PO status. If Received, increments stock level in SQLite store_inventory."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM purchase_orders WHERE id = ?", (req.po_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Purchase order not found.")
        
        po = dict(row)
        
        if req.status == 'Received' and po['status'] != 'Received':
            # Increment stock level in SQLite ONLY when received
            cursor.execute("""
                UPDATE store_inventory
                SET stock_level = stock_level + ?
                WHERE store_id = ? AND product_id = ?
            """, (po['quantity'], po['store_id'], po['product_id']))
        
        cursor.execute("""
            UPDATE purchase_orders
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (req.status, req.po_id))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Purchase Order status updated to {req.status} successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
