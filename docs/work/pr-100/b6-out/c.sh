#!/bin/bash
# usage: c.sh <jar> <METHOD> <path> [datafile|json] -> prints "<code> <body-trunc>"
J=$1; M=$2; P=$3; D=$4
if [ -n "$D" ]; then
  if [ ! -f "$D" ]; then printf "%s" "$D" > req.tmp.json; D=req.tmp.json; fi; DA="--data @$D"
fi
curl -s -b $J -H 'Content-Type: application/json' -H 'Origin: http://localhost:3100' -X $M "http://localhost:3100$P" $DA -o last.body -w "%{http_code}"
echo " $(head -c ${TRUNC:-400} last.body)"
