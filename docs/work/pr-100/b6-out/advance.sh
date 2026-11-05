#!/bin/bash
cd "$(dirname "$0")"
SUB=$(cat sub.id); QIDS=($(cat qids))
OUTS=(solved-independently supported-with-hints attempted skipped supported-with-hints unresolved attempted supported-with-hints solved-independently attempted)
for i in 0 1 2 3 4 5 6 7 8 9; do
  o=${OUTS[$i]}; h=0; [ "$o" = supported-with-hints ] && h=2; tags='[]'; [ $i = 1 ] && tags='["unlike-denominators"]'
  TRUNC=200 ./c.sh learner-l.jar POST /api/homework/submissions/$SUB/advance "{\"fromQuestionId\":\"${QIDS[$i]}\",\"expectedIndex\":$i,\"outcome\":\"$o\",\"attempts\":1,\"hintsUsed\":$h,\"misconceptionTags\":$tags}" | sed "s/^/adv $i ($o): /"
  if [ $i = 4 ]; then TRUNC=200 ./c.sh learner-l.jar POST /api/homework/submissions/$SUB/advance "{\"fromQuestionId\":\"${QIDS[3]}\",\"expectedIndex\":3,\"outcome\":\"attempted\",\"attempts\":1,\"hintsUsed\":0,\"misconceptionTags\":[]}" | sed "s/^/STALE replay of adv 3 (cursor now 5): /"; fi
done
