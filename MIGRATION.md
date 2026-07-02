# chezmoi Migration Design (final)

Migrating this repo (174 files, ex-yadm) to chezmoi 2.70+, source directory
remaining at `~/projects/dotfiles`. Decisions below are settled (2026-07-02);
open follow-ups are in §8.

## 1. Repo layout (end state)

`.chezmoiroot` = `home` — repo root stays a normal project, only `home/` is
chezmoi source state:

```
~/projects/dotfiles/
├── .chezmoiroot                 # contains: home
├── .chezmoiversion              # min chezmoi version (e.g. 2.70.0)
├── README.md                    # rewritten: chezmoi bootstrap instructions
├── UNLICENSE.md
├── scripts/                     # manual/system-level only, never deployed (see §3)
└── home/                        # chezmoi source state root
    ├── .chezmoi.toml.tmpl       # config template — prompts + sourceDir
    ├── .chezmoiignore           # templated per-machine excludes
    ├── .chezmoitemplates/       # shared template partials (if needed)
    ├── .chezmoiscripts/         # run_once_/run_onchange_ provisioning
    ├── dot_zshrc.tmpl
    ├── dot_gitconfig.tmpl
    ├── private_dot_gnupg/
    └── dot_local/bin/           # → ~/.local/bin (all executable_)
```

Bootstrap on a new machine:

```sh
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply --source ~/projects/dotfiles git@github.com:zgeoff/dotfiles.git
```

CI is deleted entirely (was a defunct meatbox Docker experiment; takes the
hardcoded `MEATBOX_PASSWORD=meatword` literal with it). Template errors get
caught by `chezmoi diff` locally. `index.sh`, `libs/`, and the yadm bootstrap
flow are deleted.

## 2. Machine data model

`home/.chezmoi.toml.tmpl` — rendered once per machine by `chezmoi init`,
prompts remembered via `*Once` functions:

```toml
{{- $email := promptStringOnce . "email" "Git email" "me@geoffwhatley.com" -}}
{{- $profile := promptChoiceOnce . "profile" "Machine profile" (list "home" "work") -}}
{{- $gui := promptBoolOnce . "gui" "Has a GUI/desktop session" -}}

sourceDir = {{ joinPath .chezmoi.homeDir "projects/dotfiles" | quote }}

[data]
    email = {{ $email | quote }}
    profile = {{ $profile | quote }}
    gui = {{ $gui }}
    wsl = {{ .chezmoi.kernel.osrelease | lower | contains "microsoft" }}
    arch = {{ and (eq .chezmoi.os "linux") (eq .chezmoi.osRelease.id "arch") }}

[git]
    autoAdd = true
    # autoCommit/autoPush stay off — repo is public; commit and push deliberately

encryption = "age"
[age]
    identity = "{{ .chezmoi.homeDir }}/.config/chezmoi/key.txt"
    recipient = "<age public key — filled in during phase 7>"
```

Derived booleans (`wsl`, `arch`) computed at init; prompts cover what can't be
detected. In practice `profile=work` ⇒ macOS (work machines are always Macs),
but the two axes stay independent — `.chezmoi.os` handles platform, `profile`
handles identity/policy. Re-run `chezmoi init` to re-render; only new prompts
ask.

Note: `sourceDir` in the generated config is what makes the custom location
stick — `--source` is needed on the very first `init` only (known quirk: some
subcommands ignore `init --source`).

## 3. File mapping rules

Mechanical renames done by `chezmoi add` (or scripted `git mv`):

| Current | Source name | Why |
|---|---|---|
| `.zshrc`, `.aliases`, … | `dot_zshrc`, `dot_aliases`, … | `dot_` prefix |
| `bin/*` (35 scripts) | `dot_local/bin/executable_<name>` | **moves to `~/.local/bin`** (XDG); exec bit preserved |
| `.gnupg/` | `private_dot_gnupg/` | dir 0700, files 0600 (gpg requires) |
| `.config/act/.env` | `dot_config/act/empty_dot_env` | chezmoi deletes empty files otherwise |
| `.config/Code - Insiders/…` | `dot_config/Code - Insiders/…` | spaces are fine; no encoding needed |
| `.config/awesome/background.jpg` | unchanged under `dot_config/` | binary OK |
| `.Xclients`, `.xinitrc`, `awesome/autorun.sh` | `executable_` prefix | exec bit |

The `~/bin` → `~/.local/bin` move requires updating PATH references in
`.env`/`.zpath` and any script that calls a sibling by absolute path; old
`~/bin` gets a `.chezmoiremove` entry (or manual cleanup) once verified.

### Files that become templates (`.tmpl`)

Template-time branching everywhere (rendered files contain zero dead code):

| File | Template driver |
|---|---|
| `.gitconfig` | `email` from data; keep the `.gitconfig.local` include as a per-machine unmanaged escape hatch |
| `.zshrc` | `/home/geoff/.bun`, `/home/geoff/.pulumi` → `{{ .chezmoi.homeDir }}`; `uname -s` Darwin branches → `{{ if eq .chezmoi.os "darwin" }}` |
| `.env`, `.zpath` | same Darwin-branch conversion + `~/.local/bin` PATH update |
| `.config/docker/daemon.json` | collapse the 3 variants (`daemon-nvidia/unknown/virtual.json`) into one template switching on GPU detection |
| `.gnupg/gpg-agent.conf` | pinentry path differs per OS/WSL |

### Per-machine exclusion — `home/.chezmoiignore`

```
{{ if not .gui }}
.config/awesome/**
.config/lutris/**
.config/rofi/**
.config/alacritty/**
.config/kitty/**
.Xresources
.Xclients
.xinitrc
.config/compton.conf
.config/gtk-*/**
.gtkrc-2.0
{{ end }}
{{ if not .arch }}
.config/pacman/**
.config/yay/**
{{ end }}
{{ if ne .chezmoi.os "darwin" }}
# darwin-only targets as they emerge during work-machine integration
{{ end }}
```

Patterns match **target** paths; excludes always win. Verify with `chezmoi ignored`.

### Provisioning scripts — two-tier

**Tier 1 — `home/.chezmoiscripts/` (chezmoi-managed):**
- `run_onchange_before_install-packages-arch.sh.tmpl` — guards on `.arch`,
  embeds `{{ include "Yayfile" | sha256sum }}` in a comment → package install
  re-runs whenever Yayfile changes. Same pattern for `Brewfile` on darwin.
- `run_once_after_setup-asdf.sh.tmpl` — replaces `bootstrap.sh` / `install_or_update_asdf.sh`.
- `run_once_` for one-time setup: `create_home_directories`,
  `set_zsh_as_default_shell`, `setup_tmux`, `setup_nvim`.

**Tier 2 — repo-root `scripts/` (manual, never deployed):**
System-level and rare-use scripts stay here *pending a staleness audit*
(follow-up, §8): `setup-archbang-liveboot.sh` (unused for ages), lightdm
configs (likely never again), pulse, x11docker, etc. Expect most of tier 2 to
be deleted in that audit rather than kept.

Script state lives in chezmoi's BoltDB; `chezmoi state delete-bucket
--bucket=scriptState` re-arms `run_once_`.

### Deletions

- `index.sh` — yadm bootstrapper
- `libs/.gitkeep` + `.gitignore`'s `libs/*` rule — existed only for vendored yadm
- `.github/workflows/ci.yml`, `scripts/arch/{Dockerfile,.dockerignore}` — CI yeeted
- `scripts/arch/Snapfile` — empty
- `.config/docker/daemon-{nvidia,unknown,virtual}.json` — replaced by template
- More expected from the tier-2 staleness audit (§8)

### Newly adopted (currently untracked in $HOME)

- `~/.ssh/config` → `private_dot_ssh/config` (config only, never keys; dir 0700)
- `~/.config/zellij/` → `dot_config/zellij/`
- `~/.config/gh/` → inspect contents first; `config.yml` plain, `hosts.yml`
  (contains OAuth token) as `encrypted_` if worth tracking
- nvim config — none exists despite `EDITOR=nvim`; noted, not a migration task

## 4. Secrets strategy

No live secrets in the repo today (audited). age encryption is set up during
migration so the pattern exists:

```
chezmoi age-keygen --output ~/.config/chezmoi/key.txt   # NOT committed
```

Config gets `encryption = "age"` + identity/recipient (§2). Key provisioned
out-of-band per machine (one-time copy). Anything sensitive that becomes
tracked (e.g. `gh/hosts.yml`) goes in as `encrypted_*.age` via
`chezmoi add --encrypt`. For work-only secrets later, prefer a
secrets-manager template function (`pass`, `onepasswordRead`) so nothing
sensitive lands in the repo at all.

## 5. Sync workflow (end state)

- Edit: `chezmoi edit <target>` → `chezmoi apply` → commit (autoAdd stages) → push
- Other machine: `chezmoi update` (pull --rebase --autostash + apply)
- Drift check: `chezmoi status` / `chezmoi diff`; live-edit capture: `chezmoi re-add`
- `chezmoi cd` → drops into `~/projects/dotfiles`

## 6. Migration plan (phased, each phase leaves a working state)

1. **Prep**: install chezmoi (`pacman -S chezmoi`); branch `chezmoi-migration`.
2. **Restructure**: create `home/`, scripted `git mv` of every deployed file
   with attribute renames (incl. `bin/` → `dot_local/bin/executable_*`); add
   `.chezmoiroot`, `.chezmoi.toml.tmpl`, `.chezmoiignore`; delete CI/yadm
   leftovers.
3. **Init + no-op check**: `chezmoi init --source ~/projects/dotfiles`; answer
   prompts; iterate until `chezmoi diff` shows only expected changes
   (`.gnupg` perm fixes, `~/.local/bin` placement, template substitutions).
   `chezmoi doctor` clean.
4. **Apply** on this machine. Verify shell chain loads (`zsh -l`), git signs,
   PATH resolves `~/.local/bin`, old `~/bin` retired.
5. **Templating pass**: convert §3 template list; `chezmoi diff` after each.
6. **Scripts pass**: tier-1 `.chezmoiscripts/` conversions; test
   `run_onchange_` re-trigger by touching Yayfile.
7. **Adopt + encrypt**: `.ssh/config`, zellij, gh (inspect first); age keygen
   + config recipient.
8. **Cleanup**: rewrite README, merge to main, push.
9. **Work Mac integration** (separate session, agent-driven on that machine):
   bootstrap one-liner, `profile=work`, fill in darwin/work-specific
   templates and `.chezmoiignore` entries as real differences surface. Work
   config was historically overwritten locally and never committed, so this
   phase discovers it in situ.

## 7. Resolved decisions (2026-07-02)

- Layout: nested `.chezmoiroot home/` ✓
- Scripts location: `~/.local/bin` (idiomatic XDG) — rename during migration ✓
- macOS: full support required — work machines are always Macs ✓
- CI: deleted ✓
- Scripts: two-tier (chezmoi-managed + manual root) ✓
- Branching: template-time, not runtime `uname` ✓
- Git automation: `autoAdd` only ✓
- Secrets: age now; encrypt anything sensitive that gets tracked ✓
- Work profile: plumbing ships now, contents filled during phase 9 ✓

## 8. Follow-ups (post-migration)

- **Tier-2 script staleness audit**: go through repo-root `scripts/`
  (liveboot, lightdm, pulse, x11docker, remaining arch/linux one-offs) and
  delete what's dead.
- **gh config inspection**: decide track/encrypt/skip per file.
- **nvim config**: doesn't exist anywhere; create + track, or change `EDITOR`.
- **Work-machine specifics**: discovered during phase 9 on the Mac.
