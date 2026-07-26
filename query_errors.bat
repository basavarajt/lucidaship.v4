@echo off
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=lucida-backend AND severity>=ERROR" --limit 50 --format=json > errors.json
