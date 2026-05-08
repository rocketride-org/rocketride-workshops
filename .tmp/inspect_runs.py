import json, re, sys
with open('C:/Users/joshu/Repositories/rocketride-org/rocketride-workshops/workshops/coding-agent/solution/logs/2026-05-07_tracer.log','r',encoding='utf-8') as f:
    text = f.read()
blocks = re.findall(r'===== run start.*?=====\n(.*?)\n===== run end', text, re.DOTALL)
print(f'blocks: {len(blocks)}')
for i, b in enumerate(blocks, 1):
    try:
        j = json.loads(b)
    except Exception as e:
        print(f'run {i}: parse fail {e}')
        continue
    err = j.get('error')
    prompt = (j.get('prompt') or '')[:80]
    started = j.get('run_started')
    ended = j.get('run_ended')
    ans = ''
    if j.get('result'):
        answers = j['result'].get('answers') or []
        if answers:
            ans = str(answers[0])[:300]
    print(f'--- run {i} | started={started}')
    print(f'  prompt={prompt!r}')
    print(f'  error={err!r}')
    print(f'  answer[0]={ans!r}')
