import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "inventory.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Drop tables if they exist to start fresh
    cursor.execute("DROP TABLE IF EXISTS sales_history")
    cursor.execute("DROP TABLE IF EXISTS products")

    # Create products table
    cursor.execute("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            stock_level INTEGER NOT NULL,
            reorder_threshold INTEGER NOT NULL,
            expiry_date TEXT NOT NULL,  -- YYYY-MM-DD
            price_aed REAL NOT NULL
        )
    """)

    # Create sales_history table
    cursor.execute("""
        CREATE TABLE sales_history (
            product_id INTEGER,
            date TEXT NOT NULL,         -- YYYY-MM-DD
            quantity_sold INTEGER NOT NULL,
            is_ramadan INTEGER NOT NULL, -- 0 = No, 1 = Yes
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """)

    # Seed products data
    products = [
        # (name, category, stock_level, reorder_threshold, expiry_date, price_aed)
        ("Al Rawabi Fresh Milk 2L", "Dairy", 8, 15, "2026-07-18", 10.50),        # Low Stock & Near Expiry (expires in 2 days from July 16)
        ("Majdool Dates 1kg", "Dates & Sweets", 50, 20, "2027-01-15", 35.00),     # Healthy Stock
        ("Al Ain Mineral Water 6x1.5L", "Beverages", 5, 30, "2027-06-10", 8.25),   # Low Stock & Long Expiry
        ("Local Hummus 250g", "Deli", 12, 10, "2026-07-17", 6.00),                 # Healthy Stock & Near Expiry (expires in 1 day from July 16)
        ("Arabic Pita Bread Large", "Bakery", 4, 25, "2026-07-18", 3.50),          # Low Stock & Near Expiry (expires in 2 days from July 16)
        ("Sadia Chicken Breast 1kg", "Frozen Food", 45, 15, "2026-12-25", 22.00)  # Healthy Stock & Long Expiry
    ]

    cursor.executemany("""
        INSERT INTO products (name, category, stock_level, reorder_threshold, expiry_date, price_aed)
        VALUES (?, ?, ?, ?, ?, ?)
    """, products)

    # Let's retrieve generated IDs to construct correct sales history
    cursor.execute("SELECT id, name FROM products")
    product_map = {name: id for id, name in cursor.fetchall()}

    # Seed sales history to demonstrate normal vs Ramadan sales volume changes
    # Ramadan 2026 ran from approx Feb 18 to Mar 19
    sales_data = []

    # Product 1: Al Rawabi Fresh Milk 2L
    p1_id = product_map["Al Rawabi Fresh Milk 2L"]
    # Normal days (daily sales around 10-15)
    sales_data.extend([(p1_id, f"2026-01-1{i}", 10 + (i * 2) % 6, 0) for i in range(5)])
    # Ramadan days (daily sales around 20-30 - high dairy demand for Suhoor/Iftar)
    sales_data.extend([(p1_id, f"2026-02-2{i}", 22 + (i * 3) % 9, 1) for i in range(5)])

    # Product 2: Majdool Dates 1kg
    p2_id = product_map["Majdool Dates 1kg"]
    # Normal days (daily sales around 2-4)
    sales_data.extend([(p2_id, f"2026-01-1{i}", 2 + i % 3, 0) for i in range(5)])
    # Ramadan days (daily sales around 35-45 - massive demand)
    sales_data.extend([(p2_id, f"2026-02-2{i}", 35 + (i * 4) % 11, 1) for i in range(5)])

    # Product 3: Al Ain Mineral Water 6x1.5L
    p3_id = product_map["Al Ain Mineral Water 6x1.5L"]
    # Normal days (daily sales around 15-20)
    sales_data.extend([(p3_id, f"2026-01-1{i}", 15 + i % 6, 0) for i in range(5)])
    # Ramadan days (daily sales around 25-32)
    sales_data.extend([(p3_id, f"2026-02-2{i}", 26 + i % 7, 1) for i in range(5)])

    # Product 4: Local Hummus 250g
    p4_id = product_map["Local Hummus 250g"]
    sales_data.extend([(p4_id, f"2026-01-1{i}", 5 + i % 4, 0) for i in range(5)])
    sales_data.extend([(p4_id, f"2026-02-2{i}", 8 + i % 5, 1) for i in range(5)])

    # Product 5: Arabic Pita Bread Large
    p5_id = product_map["Arabic Pita Bread Large"]
    # Normal days (daily sales around 12-18)
    sales_data.extend([(p5_id, f"2026-01-1{i}", 12 + i % 7, 0) for i in range(5)])
    # Ramadan days (daily sales around 40-50)
    sales_data.extend([(p5_id, f"2026-02-2{i}", 41 + (i * 3) % 10, 1) for i in range(5)])

    # Product 6: Sadia Chicken Breast 1kg
    p6_id = product_map["Sadia Chicken Breast 1kg"]
    sales_data.extend([(p6_id, f"2026-01-1{i}", 8 + i % 4, 0) for i in range(5)])
    sales_data.extend([(p6_id, f"2026-02-2{i}", 14 + i % 6, 1) for i in range(5)])

    cursor.executemany("""
        INSERT INTO sales_history (product_id, date, quantity_sold, is_ramadan)
        VALUES (?, ?, ?, ?)
    """, sales_data)

    conn.commit()
    conn.close()
    print("Database initialized and populated successfully at:", DB_PATH)

if __name__ == "__main__":
    init_db()
