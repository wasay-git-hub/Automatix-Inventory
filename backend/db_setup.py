import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "inventory.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Drop tables if they exist to start fresh
    cursor.execute("DROP TABLE IF EXISTS sales_history")
    cursor.execute("DROP TABLE IF EXISTS store_connections")
    cursor.execute("DROP TABLE IF EXISTS store_inventory")
    cursor.execute("DROP TABLE IF EXISTS business_rules")
    cursor.execute("DROP TABLE IF EXISTS stores")
    cursor.execute("DROP TABLE IF EXISTS products")

    # 1. Create stores table
    cursor.execute("""
        CREATE TABLE stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL
        )
    """)

    # 2. Create products table
    cursor.execute("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price_aed REAL NOT NULL
        )
    """)

    # 3. Create store_inventory table
    cursor.execute("""
        CREATE TABLE store_inventory (
            store_id INTEGER,
            product_id INTEGER,
            stock_level INTEGER NOT NULL,
            reorder_threshold INTEGER NOT NULL,
            expiry_date TEXT NOT NULL,  -- YYYY-MM-DD
            PRIMARY KEY (store_id, product_id),
            FOREIGN KEY (store_id) REFERENCES stores(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """)

    # 4. Create store_connections table
    cursor.execute("""
        CREATE TABLE store_connections (
            from_store_id INTEGER,
            to_store_id INTEGER,
            distance_km REAL NOT NULL,
            PRIMARY KEY (from_store_id, to_store_id),
            FOREIGN KEY (from_store_id) REFERENCES stores(id),
            FOREIGN KEY (to_store_id) REFERENCES stores(id)
        )
    """)

    # 5. Create business_rules table
    cursor.execute("""
        CREATE TABLE business_rules (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT
        )
    """)

    # 6. Create sales_history table
    cursor.execute("""
        CREATE TABLE sales_history (
            store_id INTEGER,
            product_id INTEGER,
            date TEXT NOT NULL,         -- YYYY-MM-DD
            quantity_sold INTEGER NOT NULL,
            is_ramadan INTEGER NOT NULL, -- 0 = No, 1 = Yes
            FOREIGN KEY (store_id) REFERENCES stores(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """)

    # --- Seed Stores ---
    stores = [
        ("Dubai Marina", "Dubai Marina Retail Zone"),
        ("Downtown Dubai", "Downtown Boulevard"),
        ("Sharjah Al Nahda", "Sharjah Al Nahda District")
    ]
    cursor.executemany("INSERT INTO stores (name, location) VALUES (?, ?)", stores)

    # --- Seed Products ---
    products = [
        ("Al Rawabi Fresh Milk 2L", "Dairy", 10.50),
        ("Majdool Dates 1kg", "Dates & Sweets", 35.00),
        ("Al Ain Mineral Water 6x1.5L", "Beverages", 8.25),
        ("Local Hummus 250g", "Deli", 6.00),
        ("Arabic Pita Bread Large", "Bakery", 3.50),
        ("Sadia Chicken Breast 1kg", "Frozen Food", 22.00)
    ]
    cursor.executemany("INSERT INTO products (name, category, price_aed) VALUES (?, ?, ?)", products)

    # Retrieve IDs
    cursor.execute("SELECT id, name FROM stores")
    store_map = {name: id for id, name in cursor.fetchall()}

    cursor.execute("SELECT id, name FROM products")
    product_map = {name: id for id, name in cursor.fetchall()}

    # --- Seed Store Inventory ---
    # Store IDs: Dubai Marina (1), Downtown Dubai (2), Sharjah Al Nahda (3)
    s1_id = store_map["Dubai Marina"]
    s2_id = store_map["Downtown Dubai"]
    s3_id = store_map["Sharjah Al Nahda"]

    p_milk = product_map["Al Rawabi Fresh Milk 2L"]
    p_dates = product_map["Majdool Dates 1kg"]
    p_water = product_map["Al Ain Mineral Water 6x1.5L"]
    p_hummus = product_map["Local Hummus 250g"]
    p_bread = product_map["Arabic Pita Bread Large"]
    p_chicken = product_map["Sadia Chicken Breast 1kg"]

    # (store_id, product_id, stock_level, reorder_threshold, expiry_date)
    inventory_data = [
        # Dubai Marina (Low milk, low water, low bread)
        (s1_id, p_milk, 3, 15, "2026-07-18"),       # Low Stock & Near Expiry (expires in 2 days) -> Candidate for transfer from Downtown
        (s1_id, p_dates, 50, 20, "2027-01-15"),
        (s1_id, p_water, 5, 30, "2027-06-10"),      # Low Stock -> Candidate for transfer from Downtown
        (s1_id, p_hummus, 12, 10, "2026-07-17"),    # Near Expiry
        (s1_id, p_bread, 2, 20, "2026-07-18"),      # Low Stock & Near Expiry -> External Order needed (no branch has excess)
        (s1_id, p_chicken, 45, 15, "2026-12-25"),

        # Downtown Dubai (Excess milk, excess water, low chicken)
        (s2_id, p_milk, 25, 10, "2026-07-19"),      # Excess Stock (Can transfer to Marina)
        (s2_id, p_dates, 18, 15, "2027-01-15"),
        (s2_id, p_water, 40, 20, "2027-06-10"),     # Excess Stock (Can transfer to Marina)
        (s2_id, p_hummus, 15, 10, "2026-07-22"),
        (s2_id, p_bread, 5, 15, "2026-07-19"),      # Low Stock & Near Expiry
        (s2_id, p_chicken, 10, 15, "2026-12-25"),   # Low Stock

        # Sharjah Al Nahda (Excess bread, low dates, low hummus)
        (s3_id, p_milk, 20, 15, "2026-07-20"),
        (s3_id, p_dates, 8, 15, "2027-01-15"),      # Low Stock
        (s3_id, p_water, 25, 20, "2027-06-10"),
        (s3_id, p_hummus, 5, 10, "2026-07-17"),      # Low Stock & Near Expiry
        (s3_id, p_bread, 35, 15, "2026-07-20"),     # Excess Bread (But too far from Marina to transfer if threshold is 35km)
        (s3_id, p_chicken, 30, 20, "2026-12-25")
    ]
    cursor.executemany("""
        INSERT INTO store_inventory (store_id, product_id, stock_level, reorder_threshold, expiry_date)
        VALUES (?, ?, ?, ?, ?)
    """, inventory_data)

    # --- Seed Store Connections ---
    # Marina -> Downtown: 22.5 km (Transferable)
    # Downtown -> Sharjah: 25.0 km (Transferable)
    # Marina -> Sharjah: 42.0 km (Non-transferable if limit is 35.0 km)
    connections = [
        (s1_id, s2_id, 22.5),
        (s2_id, s1_id, 22.5),
        (s2_id, s3_id, 25.0),
        (s3_id, s2_id, 25.0),
        (s1_id, s3_id, 42.0),
        (s3_id, s1_id, 42.0)
    ]
    cursor.executemany("""
        INSERT INTO store_connections (from_store_id, to_store_id, distance_km)
        VALUES (?, ?, ?)
    """, connections)

    # --- Seed Business Rules ---
    rules = [
        ("near_expiry_days_threshold", "3", "Flag products expiring within this number of days."),
        ("ramadan_reorder_multiplier", "2.5", "Multiplier applied to average sales for reorders during Ramadan."),
        ("standard_reorder_multiplier", "1.2", "Multiplier applied to average sales for standard reorders."),
        ("allow_inter_branch_transfers", "1", "Flag to enable (1) or disable (0) stock transfers between branches."),
        ("max_transfer_distance_km", "35.0", "Maximum distance in kilometers allowed for stock transfers.")
    ]
    cursor.executemany("INSERT INTO business_rules (key, value, description) VALUES (?, ?, ?)", rules)

    # --- Seed Sales History ---
    # Constructing historical sales data per store/product.
    sales_data = []
    # Loop over stores and products to generate baseline and Ramadan sales history
    for s_id in [s1_id, s2_id, s3_id]:
        # Scale volumes: Marina (s1) has 1.2x, Downtown (s2) has 1.0x, Sharjah (s3) has 0.9x
        scale = 1.2 if s_id == s1_id else (1.0 if s_id == s2_id else 0.9)

        # Milk
        sales_data.extend([(s_id, p_milk, f"2026-01-1{i}", int(scale * (10 + (i * 2) % 6)), 0) for i in range(5)])
        sales_data.extend([(s_id, p_milk, f"2026-02-2{i}", int(scale * (22 + (i * 3) % 9)), 1) for i in range(5)])

        # Dates
        sales_data.extend([(s_id, p_dates, f"2026-01-1{i}", int(scale * (2 + i % 3)), 0) for i in range(5)])
        sales_data.extend([(s_id, p_dates, f"2026-02-2{i}", int(scale * (35 + (i * 4) % 11)), 1) for i in range(5)])

        # Water
        sales_data.extend([(s_id, p_water, f"2026-01-1{i}", int(scale * (15 + i % 6)), 0) for i in range(5)])
        sales_data.extend([(s_id, p_water, f"2026-02-2{i}", int(scale * (26 + i % 7)), 1) for i in range(5)])

        # Hummus
        sales_data.extend([(s_id, p_hummus, f"2026-01-1{i}", int(scale * (5 + i % 4)), 0) for i in range(5)])
        sales_data.extend([(s_id, p_hummus, f"2026-02-2{i}", int(scale * (8 + i % 5)), 1) for i in range(5)])

        # Pita Bread
        sales_data.extend([(s_id, p_bread, f"2026-01-1{i}", int(scale * (12 + i % 7)), 0) for i in range(5)])
        sales_data.extend([(s_id, p_bread, f"2026-02-2{i}", int(scale * (41 + (i * 3) % 10)), 1) for i in range(5)])

        # Chicken
        sales_data.extend([(s_id, p_chicken, f"2026-01-1{i}", int(scale * (8 + i % 4)), 0) for i in range(5)])
        sales_data.extend([(s_id, p_chicken, f"2026-02-2{i}", int(scale * (14 + i % 6)), 1) for i in range(5)])

    cursor.executemany("""
        INSERT INTO sales_history (store_id, product_id, date, quantity_sold, is_ramadan)
        VALUES (?, ?, ?, ?, ?)
    """, sales_data)

    conn.commit()
    conn.close()
    print("Multi-store database initialized and populated successfully at:", DB_PATH)

if __name__ == "__main__":
    init_db()
