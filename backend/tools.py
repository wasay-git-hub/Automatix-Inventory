import sqlite3
import os
from crewai.tools import tool

DB_PATH = os.path.join(os.path.dirname(__file__), "inventory.db")

@tool("Get Database Schema")
def get_schema() -> str:
    """Returns the database schema for inventory.db to understand tables and columns."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        schema_str = "\n".join([table[0] for table in tables if table[0]])
        conn.close()
        return schema_str
    except Exception as e:
        return f"Error reading database schema: {str(e)}"

@tool("Run Read-Only SQL Query")
def run_db_query(sql_query: str) -> str:
    """Executes a SELECT query on the inventory SQLite database and returns results. 
    Input should be a valid SQL SELECT statement.
    """
    query_lower = sql_query.strip().lower()
    if not query_lower.startswith("select"):
        return "Error: Only SELECT queries are allowed."
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(sql_query)
        columns = [description[0] for description in cursor.description]
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            return "No results found."
            
        # Format as a simple markdown table
        col_header = " | ".join(columns)
        divider = " | ".join(["---"] * len(columns))
        row_strings = [" | ".join(map(str, row)) for row in rows]
        return "\n".join([col_header, divider] + row_strings)
    except Exception as e:
        return f"Error executing query: {str(e)}"

@tool("Get Simulated Current System Date")
def get_system_date() -> str:
    """Returns the simulated current date of the inventory system to compare with product expiry dates."""
    return os.environ.get("SIMULATED_CURRENT_DATE", "2026-07-16")
