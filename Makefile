PROFILE ?= groundtruth
REGION  ?= us-east-1
STACK   ?= ground-truth
AWS      = aws --profile $(PROFILE) --region $(REGION)
OUT      = $(AWS) cloudformation describe-stacks --stack-name $(STACK) --query "Stacks[0].Outputs[?OutputKey=='$(1)'].OutputValue" --output text

.PHONY: setup local test lint deploy stack site seed run url

# One-time: dev tools (tests, lint, video). The backend itself has no dependencies.
setup:
	pip install -r requirements-dev.txt

# The site on http://localhost:8000 with the committed sample data; no AWS needed.
local:
	rm -rf site/data && cp -r sample/data site/data
	python -m http.server 8000 -d site

test:
	pytest -q tests

lint:
	ruff check src tests video
	cfn-lint template.yaml

# Everything: infra + code, then the static site.
deploy: stack site

stack:
	sam build
	sam deploy --stack-name $(STACK) --profile $(PROFILE) --region $(REGION) \
		--capabilities CAPABILITY_IAM --resolve-s3 --no-confirm-changeset --no-fail-on-empty-changeset

# Upload site/ (when it exists) without touching data/, then refresh CloudFront.
site:
	@if [ -d site ]; then \
		$(AWS) s3 sync site/ s3://$$($(call OUT,SiteBucketName))/ --delete --exclude "data/*" && \
		$(AWS) cloudfront create-invalidation --distribution-id $$($(call OUT,DistributionId)) --paths "/*" >/dev/null && \
		echo "site uploaded"; \
	else echo "no site/ yet, skipping"; fi

# One-off: seed the 28-day cache from the public archive so the first run has history.
seed:
	python src/backfill.py .cache/hourly.json --days 29 --cache .cache/archive
	$(AWS) s3 cp .cache/hourly.json s3://$$($(call OUT,SiteBucketName))/data/raw/hourly.json

# Run the ingest now instead of waiting for the hour; prints the run's summary.
run:
	$(AWS) lambda invoke --function-name $$($(call OUT,IngestFunctionName)) --cli-read-timeout 700 /dev/stdout

url:
	@$(call OUT,SiteUrl)
