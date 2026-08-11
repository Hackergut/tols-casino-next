#!/bin/bash
cd /home/z/my-project/mini-services/telegram-service
exec bun index.ts >> service.log 2>&1
