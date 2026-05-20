# AGENTS.md - Project Instructions

## Project Overview
**Python for Arab Kids** is an interactive, gamified learning platform inspired by CS50, designed to teach Python programming to children in Arabic.

### Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Python Engine**: [Pyodide](https://pyodide.org/) (Python 3.11+ in the browser).
- **Markdown Rendering**: [Marked](https://marked.js.org/).
- **Code Editor**: [CodeMirror 5](https://codemirror.net/5/).
- **Syntax Highlighting**: [Highlight.js](https://highlightjs.org/).
- **Persistence**: LocalStorage for player state.

## Core Mandates for Agents

### 1. Educational Tone
- Use encouraging, imaginative Arabic (Modern Standard Arabic).
- Refer to the user as "صانع العوالم" (World Maker).
- Concepts must be explained with analogies (e.g., variables as boxes).

### 2. Code Standards
- **LTR for Code**: All code snippets, editors, and outputs MUST be `direction: ltr`.
- **RTL for Text**: All Arabic content MUST be `direction: rtl`.
- **Modular JS**: Keep `App` logic in `app.js` and data in `db.js`.
- **Surgical Edits**: Use targeted `replace` calls for large files like `db.js`.

### 3. Mission Validation
- Avoid over-strict regex or substring matching.
- Prioritize logical correctness over exact output strings (unless specified).
- Always provide helpful Arabic feedback for failed missions.

### 4. UI/UX
- Maintain the "dark space/magical" theme.
- Ensure all interactive elements have hover/active states.
- Gamification (XP, Levels, Achievements) must be updated via `App.addXp()` and `App.unlockAchievement()`.

## Files Structure
- `index.html`: Main layout and CDN imports.
- `style.css`: Theme, animations, and layout (Mobile responsive).
- `app.js`: Application logic, state management, Pyodide integration.
- `db.js`: The "Database" containing all chapters, missions, and achievements.
- `main.js`: Entry point.

## How to add a new Chapter
1. Open `db.js`.
2. Add a new object to the `chapters` array.
3. Include `id`, `title`, `icon`, `markdownContent`, and an optional `mission` object with `placeholder` and `validate` function.
4. Ensure the `validate` function returns `{ pass: boolean, message: string }`.

## Testing
- Run a local server (e.g., `npx serve .` or `python -m http.server`).
- Open the console to check for Pyodide loading status and XP/Level logs.
- Manually verify mission validations in the browser.
