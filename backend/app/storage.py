import boto3
import os
endpoint = os.getenv('MINIO_ENDPOINT', 'localhost:9000')
access = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
secret = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
s3 = boto3.client('s3', endpoint_url=f'http://{endpoint}', aws_access_key_id=access, aws_secret_access_key=secret)
bucket = 'videos'
def ensure_bucket():
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception:
        s3.create_bucket(Bucket=bucket)

def presigned_upload(key, expires_in=3600):
    ensure_bucket()
    return s3.generate_presigned_post(Bucket=bucket, Key=key, ExpiresIn=expires_in)

def public_url(key):
    return f'http://{endpoint}/{bucket}/{key}'
