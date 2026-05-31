---
name: skill-creator
description: Guide for creating effective skills. Use when users want to create a new skill, update an existing skill, or learn how to structure skills that extend the agent's capabilities with specialized knowledge, workflows, or tool integrations.
---

# Skill Creator

Create effective skills for Google Antigravity.

## About Skills

Skills are reusable packages of knowledge that extend what the agent can do. Each skill contains instructions for specific tasks, best practices to follow, and optional scripts and resources.

Skills follow **progressive disclosure**:

1. **Discovery**: Agent sees skill names and descriptions at conversation start
2. **Activation**: If a skill looks relevant, the agent reads full SKILL.md content
3. **Execution**: Agent follows skill instructions while working on the task

### Skill Locations

| Location | Scope |
|---|---|
| `<workspace>/.agents/skills/<skill>/` | Workspace-specific |
| `~/.gemini/antigravity/skills/<skill>/` | Global (all workspaces) |

### Anatomy of a Skill

```
skill-name/
├── SKILL.md          # Main instructions (required)
├── scripts/          # Helper scripts (optional)
├── examples/         # Reference implementations (optional)
└── resources/        # Templates, docs, assets (optional)
```

#### SKILL.md

Two parts:

- **Frontmatter** (YAML): `name` (optional, defaults to folder name) and `description` (required). The description is what the agent sees during discovery to decide whether to activate the skill.
- **Body** (Markdown): Detailed instructions loaded only after activation.

#### Bundled Resources

**scripts/** — Executable code for deterministic or repetitive tasks. Encourage the agent to run scripts with `--help` first rather than reading the entire source code. This keeps the agent's context focused on the task.

**examples/** — Reference implementations and input/output pairs. Useful for teaching patterns through demonstration rather than verbose rules.

**resources/** — Templates, documentation, configuration files, and other assets. API docs, database schemas, brand templates, boilerplate code all go here.

## Core Principles

### Be Concise

The context window is shared with everything else the agent needs. Only add context the agent doesn't already have. Challenge each piece of information: "Does the agent really need this?" Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

- **High freedom** (text instructions): Multiple valid approaches, context-dependent decisions
- **Medium freedom** (pseudocode/parameterized scripts): Preferred pattern exists, some variation acceptable
- **Low freedom** (specific scripts): Fragile operations, consistency critical, exact sequence required

### Progressive Disclosure

Keep SKILL.md body under 500 lines. Split detailed content into `resources/` files with clear pointers from SKILL.md about when to read them.

**Pattern: Domain-specific organization**

```
bigquery-skill/
├── SKILL.md (overview + navigation)
└── resources/
    ├── finance.md
    ├── sales.md
    └── product.md
```

Agent reads only the relevant resource file.

### Include Decision Trees

For complex skills, add a section that helps the agent choose the right approach:

```markdown
1. Determine the task type:
   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below
```

### What NOT to Include

Only include files the agent needs to do the job. Do not create README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, or other auxiliary documentation.

## Skill Creation Process

1. Understand the skill with concrete examples
2. Plan reusable contents (scripts, examples, resources)
3. Initialize the skill (run `init_skill.py`)
4. Edit the skill (implement resources and write SKILL.md)
5. Test the skill manually
6. Package the skill (run `package_skill.py`)
7. Iterate based on real usage

### Step 1: Understand with Concrete Examples

Skip only when usage patterns are already clearly understood.

Ask the user focused questions:

- "What should this skill enable the agent to do?"
- "Can you give examples of how it would be used?"
- "What would a user say that should trigger this skill?"

Avoid overwhelming with too many questions at once. Conclude when functionality scope is clear.

### Step 2: Plan Reusable Contents

Analyze each example to identify what should be bundled:

| Signal | Resource to bundle |
|---|---|
| Same code rewritten each time | `scripts/` (e.g., `rotate_pdf.py`) |
| Same boilerplate every time | `resources/` templates (e.g., React boilerplate) |
| Agent re-discovers schemas/APIs | `resources/` docs (e.g., `schema.md`) |
| Patterns best taught by example | `examples/` (e.g., input/output pairs) |

### Step 3: Initialize the Skill

Skip if the skill already exists. Run:

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

This creates a template skill directory with SKILL.md and example subdirectories (`scripts/`, `examples/`, `resources/`). Customize or delete the generated files as needed.

### Step 4: Edit the Skill

The skill is created for another agent instance to use. Include information that would be beneficial and non-obvious. Consider what procedural knowledge or domain-specific details would help the agent execute effectively.

#### Design Patterns

Consult these guides as **reference patterns** (do not copy them verbatim into the new skill):

- **Multi-step processes**: See `resources/workflows.md`
- **Output formats or quality standards**: See `resources/output-patterns.md`

#### Implement Resources

Start with the reusable resources identified in Step 2. This may require user input (e.g., brand assets, API docs).

Test added scripts by actually running them. Delete any empty directories not needed for the skill.

#### Write SKILL.md

**Frontmatter:**

- `description` (required): The primary activation mechanism. Include what the skill does AND when to use it. Include keywords that help the agent recognize relevance.
  - Example: `"Reviews code changes for bugs, style issues, and best practices. Use when reviewing PRs or checking code quality."`
- `name` (optional): Defaults to folder name. Kebab-case, lowercase.

**Body:** Use imperative form. Write instructions for using the skill and its resources. Keep focused — the body is only loaded after activation.

**Clean up:** After writing, review the final SKILL.md to ensure:
- All TODO placeholders have been replaced with actual content
- No meta-guidance about "how to write skills" remains in the file
- The file contains ONLY the skill's own instructions for the agent

### Step 5: Test the Skill

Before packaging, test the skill manually:

1. **Create 2-3 realistic test prompts** — the kind of thing a real user would say
2. **Try each prompt** with the skill active in Antigravity
3. **Review the results**: Did the agent follow instructions? Did it use bundled scripts/resources?
4. **Note issues**: Where did the agent struggle or deviate?

Save test cases to `evals/evals.json` for future reference. See `resources/schemas.md` for the schema.

### Step 6: Package the Skill

```bash
scripts/package_skill.py <path/to/skill-folder>
```

Optional output directory:

```bash
scripts/package_skill.py <path/to/skill-folder> ./dist
```

The script validates the skill (frontmatter, naming, structure) and creates a `.skill` file (zip format) for distribution.

### Step 7: Iterate

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Update SKILL.md or bundled resources
4. Test again

**When improving:**
- Generalize from specific feedback — don't overfit to test cases
- Keep instructions lean — remove what's not pulling its weight
- Explain the why — the agent responds better to reasoning than rigid MUSTs

## Writing Good Descriptions

The `description` field determines whether the agent activates the skill. Write it in third person with keywords that help the agent match user intent.

**Good descriptions:**
- Specific about what the skill does and when to use it
- Include keywords users would naturally say
- Cover both obvious and non-obvious trigger scenarios

**Example:**
```yaml
description: Generates unit tests for Python code using pytest conventions.
  Use when the user asks to write tests, add test coverage, or verify
  code correctness for Python projects.
```

**Bad descriptions:**
- Too vague: `"Helps with testing"`
- Too narrow: `"Runs pytest on main.py"`

## Reference Files

- `resources/workflows.md` — Patterns for sequential and conditional workflows
- `resources/output-patterns.md` — Template and example patterns for output formats
- `resources/schemas.md` — JSON schemas for eval test cases
