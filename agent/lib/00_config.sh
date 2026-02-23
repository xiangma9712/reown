# agent/lib/00_config.sh — Default constants
# Each variable uses ${VAR:-default} so CLI argument overrides are preserved.

MAX_ITERATIONS="${MAX_ITERATIONS:-0}"          # 0 = infinite
MAX_BUDGET_USD="${MAX_BUDGET_USD:-5}"           # per claude invocation
AGENT_LABEL="${AGENT_LABEL:-agent}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"
ROADMAP_MAX_TURNS="${ROADMAP_MAX_TURNS:-10}"
IMPLEMENT_MAX_TURNS="${IMPLEMENT_MAX_TURNS:-30}"
FIX_MAX_TURNS="${FIX_MAX_TURNS:-15}"
CI_MAX_ATTEMPTS="${CI_MAX_ATTEMPTS:-5}"         # max CI check+fix cycles
CI_INITIAL_WAIT="${CI_INITIAL_WAIT:-60}"        # seconds to wait before first CI check
CI_POLL_INTERVAL="${CI_POLL_INTERVAL:-30}"      # seconds between CI status polls
PROPOSE_MAX_TURNS="${PROPOSE_MAX_TURNS:-10}"
