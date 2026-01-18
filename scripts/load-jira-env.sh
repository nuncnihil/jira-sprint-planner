#!/usr/bin/env bash

# Usage (must be sourced):
#   source ./load-jira-env.sh
# or:
#   . ./load-jira-env.sh

set -euo pipefail

ENV_FILE="${JIRA_ENV_FILE:-/Users/lshaw/src/jira.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  echo "Set JIRA_ENV_FILE to override, e.g.:" >&2
  echo "  JIRA_ENV_FILE=/path/to/jira.env source ./load-jira-env.sh" >&2
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "Loaded Jira env from: $ENV_FILE"

