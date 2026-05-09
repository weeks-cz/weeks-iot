<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repo & team workflow

- **GitHub**: `weeks-cz/weeks-iot` (public, transferred from lxkask/weeks-iot on 2026-05-09).
- **Org**: `weeks-cz` (free, owned by Lukáš). Owners: Lukáš (lukoluko8), Štěpán (step4n), Kryštof (jezdikk), admin@weeks.cz.
- **Sister repos**: `weeks-cz/weeks` (weeks.cz), `weeks-cz/weeks-hub` (app.weeks.cz). All public, code-only.
- **Strategic docs**: live in private repo `weeks-cz/weeks-internal` under `iot/docs/`. ROADMAP, audit findings, 3D print studio status, plans, specs all moved there 2026-05-09. **Do not commit business strategy here** — this repo is now public.
- **Domains**: `iot.weeks.cz` deploys from `main` branch (production), `klicenka.weeks.cz` deploys from `klicenka` branch (preview env wired in Vercel Domain settings). Klicenka serves NFC keychain guide for Maker Faire QR codes via host-conditional redirect in `vercel.json`.
- **Vercel Hobby author block**: Free tier rejects deployments when commit author is not Lukáš (lukoluko8@gmail.com). Commits by step4n or jezdikk hit error: *"Git author X must have access to the project on Vercel"*.
  - **Workaround until Vercel Pro upgrade ($20/mo, deferred until s.r.o.)**: Lukáš (or Claude) squashes Š/K feature branches into a single Lukáš-authored commit on main:
    ```bash
    cd <fresh-clone>
    git checkout main && git pull
    git read-tree -u --reset <feature-branch>
    git -c user.email=lukoluko8@gmail.com commit \
      --author="Lukáš Kubík <lukoluko8@gmail.com>" \
      -m "feat(...): squashed <feature-branch>"
    git push origin main
    ```
- **Build checks bypass**: `next.config.ts` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` to ship despite WIP CAD circuit builder type errors. Strict typing should be re-enabled once CAD is stabilized.
