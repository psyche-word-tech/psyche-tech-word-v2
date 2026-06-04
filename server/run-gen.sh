#!/bin/bash
cd /workspace/projects/server
npx tsx src/scripts/generate-example-images.ts > /tmp/gen-images.log 2>&1
