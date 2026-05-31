#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import sys
import os
import re
from pathlib import Path


def _parse_frontmatter(text):
    """Parse simple YAML frontmatter (key: value pairs) without external dependencies.

    Handles single-line values and multi-line values that use YAML folding or
    continuation via indentation. Only supports flat key-value pairs (no nesting).

    Returns:
        dict or None if parsing fails.
    """
    result = {}
    current_key = None
    current_value_lines = []

    for line in text.split('\n'):
        # Check for a new key: value pair
        key_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)', line)
        if key_match:
            # Save previous key if exists
            if current_key is not None:
                result[current_key] = ' '.join(current_value_lines).strip()
            current_key = key_match.group(1)
            current_value_lines = [key_match.group(2).strip()]
        elif current_key is not None and (line.startswith('  ') or line.startswith('\t')):
            # Continuation line for multi-line value
            current_value_lines.append(line.strip())
        elif line.strip() == '':
            continue
        else:
            return None  # Unexpected format

    # Save last key
    if current_key is not None:
        result[current_key] = ' '.join(current_value_lines).strip()

    return result if result else None


def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, "SKILL.md not found"

    # Read and validate frontmatter
    content = skill_md.read_text()
    if not content.startswith('---'):
        return False, "No YAML frontmatter found"

    # Extract frontmatter
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Parse frontmatter (no external dependencies)
    frontmatter = _parse_frontmatter(frontmatter_text)
    if not isinstance(frontmatter, dict):
        return False, "Frontmatter must be a YAML dictionary"

    # Define allowed properties (per Antigravity spec: name optional, description required)
    ALLOWED_PROPERTIES = {'name', 'description'}

    # Check for unexpected properties
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # description is required (name is optional, defaults to folder name)
    if 'description' not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    # Validate name if provided
    name_error = _validate_name(frontmatter.get('name', ''))
    if name_error:
        return False, name_error

    # Validate description
    desc_error = _validate_description(frontmatter.get('description', ''))
    if desc_error:
        return False, desc_error

    return True, "Skill is valid!"


def _validate_name(name):
    """Validate name field. Returns error string or None."""
    if not name:
        return None
    if not isinstance(name, str):
        return f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if not name:
        return None
    if not re.match(r'^[a-z0-9-]+$', name):
        return f"Name '{name}' should be kebab-case (lowercase letters, digits, and hyphens only)"
    if name.startswith('-') or name.endswith('-') or '--' in name:
        return f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"
    if len(name) > 64:
        return f"Name is too long ({len(name)} characters). Maximum is 64 characters."
    return None


def _validate_description(description):
    """Validate description field. Returns error string or None."""
    if not isinstance(description, str):
        return f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if not description:
        return "Description cannot be empty"
    if '<' in description or '>' in description:
        return "Description cannot contain angle brackets (< or >)"
    if len(description) > 1024:
        return f"Description is too long ({len(description)} characters). Maximum is 1024 characters."
    return None

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)
    
    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)