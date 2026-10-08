# Runbook: when an alarm fires

Two CloudWatch alarms watch the stack. Both send email to the address in the `AlertEmail`
CloudFormation parameter and clear automatically when the condition resolves.

---

## `ground-truth-ingest-errors` — Lambda raised an error

**Trigger:** `AWS/Lambda Errors ≥ 1` in 2 consecutive 1-hour periods.

### What to check first

1. Open the Lambda log group `/aws/lambda/<stack>-IngestFunction-…` in CloudWatch Logs.
2. Look for the most recent `ERROR` line. Common causes:

| Log message | Cause | Fix |
|---|---|---|
| `ParameterNotFound` / `AccessDenied` on SSM | API key deleted or key param path wrong | Re-create the SSM SecureString (see issue #1); confirm `OPENAQ_KEY_PARAM` env var matches |
| `HTTP 429` from OpenAQ | Rate limit hit | Lower `MAX_CALLS` env var; the Lambda backs off automatically next run |
| `NoCredentialProviders` | IAM role detached | Check the Lambda execution role in the console |
| Any Python traceback | Bug or data-contract change | Run `make test` locally; fix and redeploy |

### Re-run manually

```bash
make run   # runs ingest.py locally against the last-seeded cache
# or
aws lambda invoke --function-name <IngestFunctionName> /tmp/out.json
```

---

## `ground-truth-stale-data` — data is more than 3 hours old

**Trigger:** custom metric `GroundTruth/DataAgeHours > 3` in one 1-hour period.
Missing data also triggers this alarm (treated as breaching).

### What to check first

1. Look for a recent `ingest-errors` alarm — the two usually fire together.
2. Check EventBridge: open the rule `ground-truth-IngestFunction-Hourly-…` and confirm it is **Enabled**.
3. Confirm the Lambda completed its last run: CloudWatch Logs should show a JSON log line with `"scored": true`.

### Re-run manually

```bash
make run
# or invoke the Lambda directly (see above)
```

The stale-data alarm clears on the next successful run once `DataAgeHours` drops below 3.
