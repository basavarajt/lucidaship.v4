import os
from google.cloud import storage

try:
    print("Bucket exists?", storage.Client().bucket('lucida-model-artifacts-201742003125').exists())
except Exception as e:
    print("Error:", e)
