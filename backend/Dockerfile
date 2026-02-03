FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y gcc g++ ffmpeg && rm -rf /var/lib/apt/lists/*
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
RUN apt-get purge -y gcc g++ && apt-get autoremove -y
COPY ./app /app/app
COPY ./templates /app/templates
COPY ./alembic.ini /app/alembic.ini
COPY ./migrations /app/migrations
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
