# Economic Competition Simulation (ECS) Demo

**Version:** 1.0  
**Project:** Strategic Simulation Group  

## Overview

The Economic Competition Simulation is a web-based platform for conducting strategic economic competition exercises between teams representing different nations/actors. This demo focuses on the **Blue Team** (United States) with support for Green (Allies) and Red (Adversary) teams.

## Project Structure

```
ECS_demo/
├── index.html                  # Main landing page with team selection
├── js/
│   ├── app.js                 # Main app initialization
│   ├── facilitator.js         # Blue Team facilitator logic
│   ├── notetaker.js          # Blue Team notetaker logic
│   ├── whitecell.js          # White Cell control logic
│   ├── utils.js              # Shared utility functions
│   ├── autoSave.js           # Auto-save functionality
│   └── loading.js            # Loading state management
├── teams/
│   └── blue/
│       ├── blue_facilitator.html   # Blue Team facilitator interface
│       ├── blue_notetaker.html     # Blue Team notetaker interface
│       └── blue_white_cell.html    # White Cell control interface
├── styles/
│   ├── main.css              # Main landing page styles
│   ├── blue_facilitator.css  # Facilitator-specific styles
│   ├── blue_notetaker.css    # Notetaker-specific styles
│   └── blue_whitecell.css    # White Cell-specific styles
└── data_storage/             # Auto-saved data files
    ├── facilitators/         # Facilitator exports
    ├── notetakers/          # Notetaker exports
    ├── white-cells/         # White Cell exports
    └── team_submissions/    # Team submissions
```

## Quick Start

### 1. Setup

No build process required! This is a pure client-side application.

1. Clone or download this repository
2. Open `index.html` in a modern web browser (Chrome, Edge, Firefox recommended)
3. Select your team role from the main page

### 2. Browser Requirements

- **Required:** Modern browser with JavaScript enabled
- **Recommended:** Chrome/Edge 90+, Firefox 88+, Safari 14+
- **Storage:** LocalStorage must be enabled
- **Optional:** File System Access API support (Chrome/Edge) for direct file saving

### 3. Running the Simulation

#### For White Cell Control (Simulation Administrator):
1. Open `teams/blue/blue_white_cell.html`
2. Set the session ID (e.g., `session-001`)
3. Control move, phase, and timer for all participants
4. Monitor all team activities in real-time
5. Respond to team requests and adjudicate actions

#### For Blue Team Facilitator:
1. Open `teams/blue/blue_facilitator.html`
2. Move/phase/timer are controlled by White Cell (read-only)
3. Track team information requests
4. Document team actions and decisions
5. Record observations and submit to White Cell

#### For Blue Team Notetaker:
1. Open `teams/blue/blue_notetaker.html`
2. Move/phase/timer are controlled by White Cell (read-only)
3. Capture real-time observations during deliberations
4. Document team dynamics, alliance engagement
5. Track actions decided by the team
6. Submit comprehensive notes to White Cell

## Key Features

### Session Management
- **Session ID:** Unique identifier for each simulation run
- **Moves:** 3 moves representing different time epochs (2027-2030, 2030-2032, 2032-2034)
- **Phases:** 5 phases per move
  1. Internal Deliberation (30-40 min)
  2. Alliance Consultation (20-30 min)
  3. Finalization (10-15 min)
  4. Adjudication (15-20 min)
  5. Results Brief (10-15 min)

### Data Management

#### Auto-Save
- Automatically saves data every 30 seconds
- **Two modes:**
  1. **Direct File Access** (Chrome/Edge): Click "Select Data Storage Folder" button
     - Choose the project root folder
     - Files save directly to `data_storage/` subdirectories
  2. **Download Fallback**: Automatic downloads with timestamped filenames
     - Save downloaded files to `data_storage/` manually

#### Manual Export
- Click "Export Data" button on any page
- Downloads JSON file with all current data
- Includes session ID, move, and timestamp

#### Data Persistence
- All data stored in browser LocalStorage
- Survives page refresh and browser restart
- Unique keys per session and move
- Automatic migration of legacy data formats

### Role Permissions

| Feature | White Cell | Facilitator | Notetaker |
|---------|-----------|------------|-----------|
| Control Move/Phase | ✅ | ❌ (read-only) | ❌ (read-only) |
| Control Timer | ✅ | ❌ (read-only) | ❌ (read-only) |
| Set Session ID | ✅ | ❌ (hidden) | ❌ (hidden) |
| Submit Actions | ❌ | ✅ | ❌ |
| Capture Notes | ✅ | ✅ | ✅ |
| View Timeline | ✅ (all teams) | ✅ (own team) | ✅ (own team) |

## Workflow

### Typical Simulation Flow

1. **Pre-Simulation Setup** (White Cell)
   - Open White Cell interface
   - Create new session ID
   - Brief all participants on roles

2. **Move 1, Phase 1: Internal Deliberation**
   - White Cell starts timer (90 minutes default)
   - Facilitator guides team discussions
   - Notetaker captures real-time observations
   - Team discusses strategy and potential actions

3. **Move 1, Phase 2: Alliance Consultation**
   - White Cell advances to Phase 2
   - Team may consult with allies (Green Team)
   - White Cell provides requested information
   - Facilitator tracks information requests

4. **Move 1, Phase 3: Finalization**
   - White Cell advances to Phase 3
   - Team finalizes action decisions
   - Facilitator documents final actions
   - Both facilitator and notetaker submit data

5. **Move 1, Phase 4: Adjudication**
   - White Cell processes submissions
   - Determines outcomes based on rules
   - Prepares feedback for teams

6. **Move 1, Phase 5: Results Brief**
   - White Cell delivers outcomes
   - Teams react to results
   - Notetaker captures reactions
   - Prepare for next move

7. **Repeat for Moves 2 and 3**

## Data Storage Details

### LocalStorage Keys
- `currentSessionId` - Active session identifier
- `actions_session_{id}_move_{n}` - Facilitator actions
- `notes_session_{id}_move_{n}` - Notetaker notes
- `whiteCell_session_{id}_move_{n}` - White Cell data
- `sharedGameState_session_{id}` - Shared move/phase state
- `sharedTimer_session_{id}` - Shared timer state

### Export Filenames
- Facilitator: `facilitator_session_{id}_move_{n}_{timestamp}.json`
- Notetaker: `notetaker_session_{id}_move_{n}_{timestamp}.json`
- White Cell: `whitecell_session_{id}_move_{n}_{timestamp}.json`
- Submissions: `team_actions_session_{id}_move_{n}_{timestamp}.json`

## Troubleshooting

### "Storage full" errors
- Export your data using "Export Data" button
- Clear old sessions from browser LocalStorage
- Use browser DevTools > Application > Local Storage to manually clear

### Timer not syncing
- White Cell must be open and controlling the timer
- Refresh facilitator/notetaker pages to sync
- Check that all pages have same session ID

### Data not saving
1. Check browser console for errors (F12)
2. Ensure LocalStorage is enabled in browser settings
3. Try "Select Data Storage Folder" for direct file access
4. Use "Export Data" as backup method

### Auto-save downloads too many files
- Click "Select Data Storage Folder" button
- Choose project root folder when prompted
- Files will save directly instead of downloading

### Pages not loading
- Check browser console for JavaScript errors
- Ensure all files are in correct directory structure
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Known Limitations

1. **Green and Red Teams:** Currently only Blue Team is fully implemented
   - Green/Red links on main page are placeholders
   - Files do not exist yet (planned for future versions)

2. **File System Access API:** 
   - Only works in Chrome/Edge browsers
   - Requires user permission each session
   - Falls back to downloads in other browsers

3. **LocalStorage Limits:**
   - Typical limit: 5-10MB per domain
   - Large simulations may need periodic exports
   - No server-side backup

4. **Real-time Sync:**
   - Uses polling every 1 second for updates
   - Not true real-time (no WebSocket)
   - Pages must be open simultaneously

5. **Single Browser Instance:**
   - Data stored per browser instance
   - Different browsers don't share data
   - Use same browser for all roles

## Development Notes

### Technical Stack
- **Frontend:** Pure HTML5, CSS3, JavaScript (ES6+)
- **Storage:** Browser LocalStorage API
- **File Access:** File System Access API (optional)
- **No Backend:** Fully client-side application
- **No Dependencies:** No external libraries required

### Browser APIs Used
- LocalStorage API
- File System Access API (optional)
- Blob API
- URL.createObjectURL
- CustomEvent for cross-page communication
- addEventListener('storage') for cross-tab updates

### Code Organization
- Modular JavaScript files for each role
- Shared utilities in `utils.js`
- Auto-save logic separated in `autoSave.js`
- Consistent naming conventions
- Comprehensive error handling

## Future Enhancements

### Planned Features
- [ ] Green and Red Team implementations
- [ ] Server-side data persistence
- [ ] Real-time WebSocket updates
- [ ] Multi-team timeline visualization
- [ ] Export to PDF/Word formats
- [ ] Data analytics and reporting
- [ ] Undo/redo improvements
- [ ] Keyboard shortcuts
- [ ] Dark mode theme
- [ ] Mobile responsive design

### Contribution Guidelines
This is a demo project. For production use:
1. Add comprehensive testing
2. Implement server-side API
3. Add authentication/authorization
4. Enhance data validation
5. Add audit logging
6. Improve accessibility (WCAG 2.1)

## License

[Specify your license here]

## Contact

For questions or issues, please contact the Strategic Simulation Group.

---

**Last Updated:** December 8, 2025  
**Demo Version:** 1.0
