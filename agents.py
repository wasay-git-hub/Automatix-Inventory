import os
from crewai import Agent
from langchain_openai import ChatOpenAI
from tools import get_schema, run_db_query, get_system_date

# Initialize OpenAI LLM
# This model will be used by all agents
openai_api_key = os.environ.get("OPENAI_API_KEY")
model_name = os.environ.get("OPENAI_MODEL_NAME", "gpt-4o-mini")

llm = ChatOpenAI(
    model=model_name,
    temperature=0.2,
    openai_api_key=openai_api_key
)

# 1. The Interface Agent (The Manager)
interface_agent = Agent(
    role="Supermarket Operations Manager",
    goal="Coordinate the inventory squad, parse staff queries, and compile the final restocking and alert report.",
    backstory=(
        "You are the main interface at Automatix. You receive text prompts from store managers, "
        "direct the data miners and risk analysts to audit the stock, and consolidate the final "
        "dashboard response. You translate complex stock tables into clear, actionable advice for management."
    ),
    llm=llm,
    verbose=True,
    allow_delegation=True
)

# 2. The SQL Agent (The Data Miner)
sql_agent = Agent(
    role="Database Specialist",
    goal="Write and execute read-only SQL queries to inspect the live inventory database in real-time.",
    backstory=(
        "You are a meticulous data engineer. You never guess stock levels or expiry dates; "
        "instead, you inspect the database schema and write standard SQL SELECT statements "
        "to retrieve live, exact numbers from the inventory tables."
    ),
    tools=[get_schema, run_db_query, get_system_date],
    llm=llm,
    verbose=True,
    allow_delegation=False
)

# 3. The Alerts Agent (The Watchman)
alerts_agent = Agent(
    role="Stock Risk Auditor",
    goal="Monitor and flag products that are below reorder thresholds or expiring within 3 days.",
    backstory=(
        "You are the store's safety net. You analyze the database schema and query results "
        "specifically looking for items that are low in stock (stock_level <= reorder_threshold) "
        "or expiring within 3 days of the simulated current system date. You compile clean alerts lists."
    ),
    tools=[run_db_query, get_system_date],
    llm=llm,
    verbose=True,
    allow_delegation=False
)

# 4. The Analysis Agent (The Predictor)
analysis_agent = Agent(
    role="UAE Retail Demand Planner",
    goal="Analyze current stock levels and historical sales to recommend reorder quantities tailored to UAE demand shifts.",
    backstory=(
        "You are a retail strategist familiar with Middle East hypermarkets. You analyze historical "
        "sales data (like baseline vs Ramadan sales) to recommend replenishment quantities. You ensure "
        "dates, milk, and pita bread are ordered in higher quantities during festive seasons, and suggest "
        "creative promotions or markdowns for expiring items to reduce waste."
    ),
    tools=[run_db_query],
    llm=llm,
    verbose=True,
    allow_delegation=False
)
