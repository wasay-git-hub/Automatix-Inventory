from crewai import Task
from agents import interface_agent, sql_agent, alerts_agent, analysis_agent, command_agent

# 1. SQL Query Task (SQL Agent)
sql_query_task = Task(
    description=(
        "1. Inspect the database schema of 'inventory.db' using the schema tool to understand the new tables.\n"
        "2. Query all active business rules from the 'business_rules' table to determine current operational parameters.\n"
        "3. Query the list of stores from the 'stores' table and the connection distances from 'store_connections'.\n"
        "4. Query the entire list of products and their store-specific inventory levels, reorder thresholds, and expiry dates from the 'store_inventory' table.\n"
        "5. Query the sales history from 'sales_history' for all products by store, noting average quantities sold during normal days vs. Ramadan (is_ramadan = 1)."
    ),
    expected_output=(
        "A structured markdown compilation containing: \n"
        "- All active business rules (keys and values)\n"
        "- The store list and connection distances\n"
        "- Per-store inventory levels, thresholds, and expiry dates\n"
        "- Per-store historical sales averages for normal vs. Ramadan periods."
    ),
    agent=sql_agent
)

# 2. Alert Generation Task (Alerts Agent)
alerts_task = Task(
    description=(
        "1. Retrieve the simulated current system date using the get_system_date tool.\n"
        "2. Dynamically look up the 'near_expiry_days_threshold' from the business rules queried in the previous task.\n"
        "3. Analyze the per-store inventory levels and identify any product where: \n"
        "   - The current stock_level is less than or equal to its reorder_threshold (Low Stock).\n"
        "   - The expiry_date is within 'near_expiry_days_threshold' of the simulated current date (Near Expiry).\n"
        "4. Create a clean list of active alerts grouped by store branch, specifying the product, category, store, stock level, threshold, expiry date, and the specific alert type (Low Stock, Near Expiry, or both)."
    ),
    expected_output=(
        "A markdown report grouping active alerts by store branch, with clear tables displaying product name, "
        "current stock, reorder threshold, expiry date, and alert types."
    ),
    agent=alerts_agent,
    context=[sql_query_task]
)

# 3. Demand Forecasting & Recommendation Task (Analysis Agent)
analysis_task = Task(
    description=(
        "1. Analyze active alerts, store connection distances, and sales history while respecting the rules retrieved from the 'business_rules' table.\n"
        "2. For each Low Stock alert at a branch:\n"
        "   - Check if transfers are enabled ('allow_inter_branch_transfers' = 1).\n"
        "   - If yes, identify if any other branch has excess stock of the same product (stock_level > reorder_threshold).\n"
        "   - Check the distance between the two branches.\n"
        "   - If the distance is within the allowed 'max_transfer_distance_km', formulate a standard 'Optimized Standard Transfer' recommendation. Ensure the source branch remains above its own threshold.\n"
        "   - If the distance exceeds 'max_transfer_distance_km' but excess stock is available, do NOT discard this option. Instead, flag it as an 'Urgent Operator Override Opportunity (Stock Transfer Backup)', noting the exact distance and quantity, so the human decision-maker can evaluate if the urgency overrides the distance limit.\n"
        "   - If transfers are disabled, or if no branch has excess stock, recommend an external supplier order.\n"
        "3. To calculate reorders, use the sales history:\n"
        "   - If the product experiences a demand spike during Ramadan (is_ramadan = 1 sales are high) and a holiday period is approaching, multiply average sales by 'ramadan_reorder_multiplier'.\n"
        "   - Otherwise, multiply average sales by 'standard_reorder_multiplier'.\n"
        "4. For near-expiry items, suggest specific pricing markdown promotions (e.g. 50% discount) to clear stock before expiration and reduce waste.\n"
        "5. Emphasize that all suggestions are decision-support recommendations, and the final action is determined by the human operator."
    ),
    expected_output=(
        "A detailed replenishment and transfer recommendation report grouped by branch, detailing: \n"
        "- Recommended standard inter-branch stock transfers (source, destination, quantity, distance, reasoning)\n"
        "- Urgent operator override stock transfer options (excess stock available but distance limit exceeded)\n"
        "- Recommended external supplier orders (product, quantity, multiplier used, reasoning)\n"
        "- Markdown promotion plans for near-expiry products."
    ),
    agent=analysis_agent,
    context=[sql_query_task, alerts_task]
)

# 4. Interface Consolidation Task (Interface Agent / Manager)
interface_task = Task(
    description=(
        "1. Read the staff query: '{query}'\n"
        "2. Review the active business rules, branch-wise alerts, and transfer/replenishment recommendations.\n"
        "3. Consolidate and format this information into a premium, executive-ready Multi-Store Operations Dashboard.\n"
        "The report must include:\n"
        "   - **Executive Summary**: High-level operational status of the UAE stores.\n"
        "   - **Active System Configuration**: Table of active rules queried from 'business_rules' showing the system's current threshold and transfer rules.\n"
        "   - **Critical Stock Alerts**: Branch-wise tables showing Low Stock and Near Expiry products.\n"
        "   - **Optimized Inter-Branch Stock Transfers (Standard)**: Recommended transfers conforming to distance limit rules.\n"
        "   - **Urgent Operator Override Stock Transfers**: Highlighted transfer opportunities that violate distance rules but have excess stock available, marked for human override decisions in case of urgency.\n"
        "   - **Supplier Replenishment Orders**: Purchase orders to place with external suppliers when transfer is not feasible.\n"
        "   - **Markdown Promotion Plan**: Tactical discounts for near-expiry items.\n"
        "Ensure the layout highlights the human operator's final say over all standard and override suggestions. Use rich formatting, markdown tables, bold highlights, and clear emoji headers for a professional presentation."
    ),
    expected_output="A comprehensive, beautifully formatted Multi-Store Operations Dashboard in Markdown highlighting human-in-the-loop choices.",
    agent=interface_agent,
    context=[sql_query_task, alerts_task, analysis_task]
)

# 5. Database Command Execution Task (Command Agent)
command_task = Task(
    description=(
        "1. Inspect the database schema of 'inventory.db' using the schema tool to understand existing tables, columns, and relationships.\n"
        "2. Analyze the natural language operator command: '{command}'\n"
        "3. STRICT RULE: You must NEVER insert, update, or delete rows in the 'stores' table under any circumstances. The set of stores is fixed and static:\n"
        "   - store_id 1: 'Dubai Marina' (matches inputs like 'dubai', 'dubai marina', 'marina')\n"
        "   - store_id 2: 'Downtown Dubai' (matches inputs like 'downtown', 'downtown dubai')\n"
        "   - store_id 3: 'Sharjah Al Nahda' (matches inputs like 'sharjah', 'al nahda', 'sharjah branch')\n"
        "   Always map any branch references in the command to one of these three store_ids. Do not create new stores.\n"
        "4. STRICT RULE: Before inserting a product, query the 'products' table (case-insensitively or with LIKE) to see if it already exists. If the product exists, reuse its product_id. Do not insert a duplicate product row.\n"
        "5. STRICT RULE: If the request is to add stock, reduce stock, increase stock, or set stock levels for an existing product/store combination, write an UPDATE on 'store_inventory' (e.g. UPDATE store_inventory SET stock_level = ? WHERE store_id = ? AND product_id = ?) rather than inserting a new row. Do not cause primary key violations.\n"
        "6. Execute the SQL queries using the database modification tool.\n"
        "7. Verify that the changes succeeded (e.g. write a select query to check the updated row values).\n"
        "8. Provide a clean, human-friendly operations summary in markdown. Do not include raw SQL statement logs in the final response. Instead, write a polished summary showing: \n"
        "   - A success text message (e.g. 'Successfully updated stock of Cadbury Dairy Milk in Dubai Marina to 11')\n"
        "   - A clean markdown table detailing the changes (e.g. Columns: Product, Branch, Attribute changed, Old Value, New Value).\n"
        "   - Ensure the output looks professional and clear for a supermarket manager."
    ),
    expected_output="A polished, human-friendly markdown summary table detailing the successful database modifications.",
    agent=command_agent
)

