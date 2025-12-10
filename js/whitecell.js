        // Use shared getSessionId from utils.js
        // Migrate data on load
        if (typeof migrateData === 'function') {
            migrateData(getSessionId());
        }

        // Move epochs mapping
        const moveEpochs = {
            1: 'Move 1: Epoch 1 (2027-2030)',
            2: 'Move 2: Epoch 2 (2030-2032)',
            3: 'Move 3: Epoch 3 (2032-2034)'
        };

        // Use shared showToast from utils.js

        // Ensure currentMove is defined before any usage
        let currentMove = parseInt(document.getElementById('moveSelector')?.value || '1');
        
        function getSharedGameStateKey() {
            const sessionId = getSessionId();
            return `sharedGameState_session_${sessionId}`;
        }
        
        function saveGameState() {
            const gameState = {
                move: currentMove,
                phase: currentPhase,
                sessionId: getSessionId(),
                lastUpdate: Date.now()
            };
            safeSetItem(getSharedGameStateKey(), gameState);
            // Dispatch custom event for same-window listeners (storage events only fire in other windows)
            window.dispatchEvent(new CustomEvent('gameStateUpdated', { detail: gameState }));
        }
        
        function changeMoveContext() {
            currentMove = parseInt(document.getElementById('moveSelector').value);
            document.getElementById('moveEpoch').textContent = moveEpochs[currentMove];
            saveGameState(); // Save to shared storage
            const sessionId = getSessionId();
            const currentData = safeGetItem(`whiteCell_session_${sessionId}_move_${currentMove}`, null) ||
                               safeGetItem(`whiteCell_move_${currentMove}`, null);
            if (currentData) {
                loadData();
            } else {
                document.querySelectorAll('input, textarea, select').forEach(el => {
                    if (el.id && el.id !== 'moveSelector') el.value = '';
                });
                timelineItems = [];
                updateTimeline();
                updateBadges();
            }
        }

        // Phase Management
        let currentPhase = 1;
        let currentFaction = null;

        const phaseGuidance = {
            1: "Phase 1: Internal Deliberation (30-40 min) — Monitor all teams' internal discussions and strategic decisions",
            2: "Phase 2: Alliance Consultation (20-30 min) — Track cross-team interactions and alliance negotiations",
            3: "Phase 3: Finalization (10-15 min) — Capture final action decisions from all teams",
            4: "Phase 4: Adjudication (15-20 min) — Process submissions and determine outcomes",
            5: "Phase 5: Results Brief (10-15 min) — Deliver outcomes and capture team reactions"
        };

        function updatePhaseGuidance() {
            const container = document.getElementById('phaseGuidanceContainer');
            container.innerHTML = `
                <div class="phase-guidance">
                    <strong>Current Phase ${currentPhase}</strong>
                    ${phaseGuidance[currentPhase]}
                </div>
            `;
        }

        document.querySelectorAll('.phase-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentPhase = parseInt(btn.getAttribute('data-phase'));
                updatePhaseGuidance();
                saveGameState(); // Save to shared storage
                saveData();
            });
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                const sectionId = item.getAttribute('data-section');
                document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
                document.getElementById(sectionId).classList.add('active');
                
                if (sectionId === 'requests') loadSubmittedRequests();
                if (sectionId === 'actions') {
                    loadSubmittedActions();
                    populateActionSelector();
                }
                if (sectionId === 'adjudication') {
                    populateActionSelector();
                    displayRulingLog();
                }
                if (sectionId === 'timeline') updateTimeline();
                if (sectionId === 'communication') displayCommunicationLog();
            });
        });

        // Faction tagging
        document.querySelectorAll('.faction-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                if (currentFaction === btn.getAttribute('data-faction')) {
                    btn.classList.remove('selected');
                    currentFaction = null;
                } else {
                    document.querySelectorAll('.faction-tag').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    currentFaction = btn.getAttribute('data-faction');
                }
            });
        });

        // Simulation phase markers
        document.querySelectorAll('.debate-marker').forEach(btn => {
            btn.addEventListener('click', () => {
                const marker = btn.getAttribute('data-marker');
                const markers = {
                    'started': '[PHASE STARTED]',
                    'shifted': '[TEAM INTERACTION]',
                    'actions': '[ADJUDICATION NEEDED]',
                    'consensus': '[RULING MADE]'
                };
                const textarea = document.getElementById('quickCaptureText');
                textarea.value = markers[marker] + ' ' + textarea.value;
            });
        });

        // Quick templates
        function insertTemplate(type) {
            const templates = {
                'disagree': `TEAM CONFLICT
• Team A: ___
• Team B: ___
• Conflict Type: ___
• Adjudication Needed: ___`,
                
                'consensus': `CROSS-TEAM COORDINATION
• Teams Involved: ___
• Coordination Type: ___
• Effectiveness: ___
• Impact: ___`,
                
                'question': `CLARIFICATION REQUESTED
• Team: ___
• Question: "___"
• Ruling Provided: ___
• Impact: ___`,
                
                'concern': `GAME BALANCE ISSUE
• Issue: ___
• Team(s) Affected: ___
• Assessment: ___
• Action Taken: ___`,
                
                'requestinfo': `RULING/OUTCOME
• Team(s): ___
• Action Being Adjudicated: ___
• Ruling: ___
• Rationale: ___
• Impact on decision: ___`
            };
            const textarea = document.getElementById('quickCaptureText');
            textarea.value = templates[type];
            textarea.focus();
            setTimeout(() => {
                const firstBlank = textarea.value.indexOf('___');
                if (firstBlank !== -1) {
                    textarea.setSelectionRange(firstBlank, firstBlank + 3);
                }
            }, 10);
        }

        // Timer - White Cell controls, shared with other interfaces
        let timerSeconds = 90 * 60;
        let timerInterval = null;
        let timerRunning = false;

        function getSharedTimerKey() {
            const sessionId = getSessionId();
            return `sharedTimer_session_${sessionId}`;
        }

        function saveTimerState() {
            const timerState = {
                seconds: timerSeconds,
                running: timerRunning,
                lastUpdate: Date.now()
            };
            safeSetItem(getSharedTimerKey(), timerState);
        }

        function updateTimer() {
            const minutes = Math.floor(timerSeconds / 60);
            const seconds = timerSeconds % 60;
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                timerEl.classList.remove('warning', 'critical');
                if (timerSeconds <= 300 && timerSeconds > 60) {
                    timerEl.classList.add('warning');
                } else if (timerSeconds <= 60) {
                    timerEl.classList.add('critical');
                }
            }
            
            // Save state to shared storage
            saveTimerState();
        }

        // Load initial timer state from shared storage
        function loadTimerState() {
            const timerState = safeGetItem(getSharedTimerKey(), null);
            if (timerState) {
                timerSeconds = timerState.seconds || 90 * 60;
                timerRunning = timerState.running || false;
                updateTimer();
                
                // If timer was running, calculate elapsed time and continue
                // Add maximum elapsed time cap (e.g., 24 hours) to prevent incorrect time if page was closed for extended period
                const MAX_ELAPSED_SECONDS = 24 * 60 * 60; // 24 hours
                if (timerRunning && timerState.lastUpdate) {
                    const elapsed = Math.floor((Date.now() - timerState.lastUpdate) / 1000);
                    const cappedElapsed = Math.min(elapsed, MAX_ELAPSED_SECONDS);
                    timerSeconds = Math.max(0, timerSeconds - cappedElapsed);
                    
                    // If elapsed time exceeds cap, reset timer instead of showing incorrect time
                    if (elapsed > MAX_ELAPSED_SECONDS) {
                        console.warn('Timer was paused for more than 24 hours. Resetting timer.');
                        timerSeconds = 90 * 60;
                        timerRunning = false;
                        showToast('Timer was reset due to extended pause');
                    }
                    
                    if (timerSeconds > 0 && timerRunning) {
                        startTimerInterval();
                    } else {
                        timerRunning = false;
                        saveTimerState();
                    }
                }
            }
        }

        function startTimerInterval() {
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                if (timerSeconds > 0) {
                    timerSeconds--;
                    updateTimer();
                } else {
                    clearInterval(timerInterval);
                    timerRunning = false;
                    saveTimerState();
                }
            }, 1000);
        }

        document.getElementById('startTimer').addEventListener('click', () => {
            if (!timerRunning) {
                timerRunning = true;
                startTimerInterval();
            }
        });

        document.getElementById('pauseTimer').addEventListener('click', () => {
            if (timerRunning) {
                clearInterval(timerInterval);
                timerRunning = false;
                saveTimerState();
            }
        });

        document.getElementById('resetTimer').addEventListener('click', () => {
            clearInterval(timerInterval);
            timerRunning = false;
            timerSeconds = 90 * 60;
            updateTimer();
        });

        // Load timer state on page load
        loadTimerState();

        // Capture Type Tabs
        let currentCaptureType = 'note';
        const hints = {
            note: 'Cross-team dynamics, rule clarifications, fairness observations, game state...',
            moment: 'Critical adjudication moments, major team decisions, turning points...',
            quote: 'Important statements from teams - include context and impact',
            requestinfo: 'Rulings made, clarifications provided, outcome determinations...'
        };

        document.querySelectorAll('.capture-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.capture-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentCaptureType = tab.getAttribute('data-type');
                document.getElementById('captureHint').textContent = hints[currentCaptureType];
                
                const placeholders = {
                    note: 'Type what you\'re observing right now...',
                    moment: 'Describe this critical moment...',
                    quote: '"Quote text here" - Speaker Name (context about why this matters)',
                    requestinfo: 'Question: ___ | Asked by: ___ | Response: ___'
                };
                document.getElementById('quickCaptureText').placeholder = placeholders[currentCaptureType];
            };
        });

        // Timeline
        let timelineItems = [];

        async function addCapture() {
            const text = document.getElementById('quickCaptureText').value.trim();
            if (text) {
                let content = text;
                if (currentFaction) {
                    const factionLabels = {
                        'blue': 'BLUE',
                        'green': 'GREEN',
                        'red': 'RED',
                        'cross': 'Cross-Team'
                    };
                    content = `[${factionLabels[currentFaction]}] ${text}`;
                }
                const item = {
                    type: currentCaptureType,
                    time: new Date().toLocaleTimeString(),
                    content: content,
                    timestamp: Date.now(),
                    phase: currentPhase,
                    faction: currentFaction,
                    team: 'WHITE',
                    move: currentMove
                };
                timelineItems.push(item);
                
                
                document.getElementById('quickCaptureText').value = '';
                updateTimeline();
                updateBadges();
                saveData();
            }
        }

        // Allow Enter to submit (Shift+Enter for new line)
        document.getElementById('quickCaptureText').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addCapture();
            }
        });

        async function updateTimeline() {
            const allTimelineItems = [...timelineItems];
            
            // Load BLUE team timeline items from facilitator/notetaker
            try {
                const sessionId = getSessionId();
                const blueKey = `whiteCell_session_${sessionId}_move_${currentMove}`;
                const blueData = safeGetItem(blueKey, {});
                if (blueData.timelineItems && Array.isArray(blueData.timelineItems)) {
                    // Filter for BLUE team items and add to timeline
                    const blueTeamItems = blueData.timelineItems.filter(item => 
                        item.team === 'blue' || item.team === 'BLUE'
                    );
                    allTimelineItems.push(...blueTeamItems);
                }
                
                // Also check for notetaker timeline items
                const notesKey = `notes_session_${sessionId}_move_${currentMove}`;
                const notesData = safeGetItem(notesKey, {});
                if (notesData.timelineItems && Array.isArray(notesData.timelineItems)) {
                    // Map notetaker items to timeline format
                    const mappedItems = notesData.timelineItems.map(item => ({
                        ...item,
                        team: 'blue',
                        time: item.time || new Date().toLocaleTimeString(),
                        timestamp: item.timestamp || Date.now()
                    }));
                    allTimelineItems.push(...mappedItems);
                }
                
                // Also check for submitted notetaker notes
                const notesSubmissionKey = `blueNotesSubmission_session_${sessionId}_move_${currentMove}`;
                const notesSubmission = safeGetItem(notesSubmissionKey, null);
                if (notesSubmission && notesSubmission.submitted) {
                    // Add submission marker to timeline
                    allTimelineItems.push({
                        type: 'submission',
                        time: new Date(notesSubmission.submittedAt || Date.now()).toLocaleTimeString(),
                        timestamp: new Date(notesSubmission.submittedAt || Date.now()).getTime(),
                        phase: notesSubmission.phase || currentPhase,
                        content: `Notetaker submitted notes (${notesSubmission.timelineItems?.length || 0} timeline items)`,
                        team: 'blue',
                        title: 'Notetaker Submission'
                    });
                }
            } catch (e) {
                console.error('Error loading BLUE timeline:', e);
                showToast('Error loading timeline data');
            }
            
            // Deduplicate timeline items
            const deduplicatedItems = deduplicateTimelineItems(allTimelineItems);
            
            // Separate items by team
            const blueItems = deduplicatedItems.filter(item => 
                item.team === 'blue' || item.team === 'BLUE'
            );
            const greenItems = deduplicatedItems.filter(item => 
                item.team === 'green' || item.team === 'GREEN'
            );
            const redItems = deduplicatedItems.filter(item => 
                item.team === 'red' || item.team === 'RED'
            );
            
            // Update counts
            document.getElementById('blueTimelineCount').textContent = `${blueItems.length} item${blueItems.length !== 1 ? 's' : ''}`;
            document.getElementById('greenTimelineCount').textContent = `${greenItems.length} item${greenItems.length !== 1 ? 's' : ''}`;
            document.getElementById('redTimelineCount').textContent = `${redItems.length} item${redItems.length !== 1 ? 's' : ''}`;
            
            // Render each team's timeline
            renderTeamTimeline('blueTimeline', blueItems, 'BLUE');
            renderTeamTimeline('greenTimeline', greenItems, 'GREEN');
            renderTeamTimeline('redTimeline', redItems, 'RED');
        }

        function renderTeamTimeline(containerId, items, team) {
            const container = document.getElementById(containerId);
            const teamColor = getTeamColor(team);
            
            // Clear existing content
            container.innerHTML = '';
            
            if (items.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>No ${team} team items yet</p></div>`;
            } else {
                // Sort items in reverse chronological order
                const sortedItems = items.slice().reverse();
                
                sortedItems.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'timeline-item';
                    itemDiv.style.margin = '0';
                    itemDiv.style.borderRadius = '0';
                    itemDiv.style.borderBottom = '1px solid var(--color-border)';
                    itemDiv.style.borderLeft = `3px solid ${teamColor}`;
                    
                    const typeLabel = item.type === 'note' ? 'Note' :
                                    item.type === 'moment' ? 'Moment' :
                                    item.type === 'quote' ? 'Quote' : 'Info';
                    
                    itemDiv.innerHTML = `
                        <div class="timeline-header">
                            <span class="timeline-time">${item.time}</span>
                            <span class="timeline-type ${item.type}">${typeLabel}</span>
                        </div>
                        <div class="timeline-content">${item.content}</div>
                    `;
                    
                    container.appendChild(itemDiv);
                });
            }
        }

        function getTeamColor(team) {
            const colors = {
                'BLUE': 'var(--color-team-blue)',
                'GREEN': 'var(--color-team-green)',
                'RED': 'var(--color-team-red)'
            };
            return colors[team] || 'var(--color-border)';
        }

        function updateBadges() {
            let totalTimelineItems = timelineItems.filter(i => i.team !== 'WHITE').length;
            
            const blueSubmitted = localStorage.getItem(`blueMove${currentMove}Submitted`);
            if (blueSubmitted) {
                const blueData = JSON.parse(blueSubmitted);
                totalTimelineItems += blueData.timelineItems?.length || 0;
            }
            
            const greenSubmitted = localStorage.getItem(`greenMove${currentMove}Submitted`);
            if (greenSubmitted) {
                const greenData = JSON.parse(greenSubmitted);
                totalTimelineItems += greenData.timelineItems?.length || 0;
            }
            
            const redSubmitted = localStorage.getItem(`redMove${currentMove}Submitted`);
            if (redSubmitted) {
                const redData = JSON.parse(redSubmitted);
                totalTimelineItems += redData.timelineItems?.length || 0;
            }
            
            document.getElementById('timelineBadge').textContent = totalTimelineItems;
            
            const requestsData = localStorage.getItem(`blueRequests_move_${currentMove}`) || localStorage.getItem(`blueRequests_session_${getSessionId()}_move_${currentMove}`) || localStorage.getItem(`blueRequestsSubmittedMove${currentMove}`);
            let requestCount = 0;
            if (requestsData) {
                const parsed = JSON.parse(requestsData);
                requestCount = Array.isArray(parsed) ? parsed.length : (parsed.requests?.length || 0);
            }
            document.getElementById('requestsBadge').textContent = requestCount;
            
            const actionsData = localStorage.getItem(`blueActions_move_${currentMove}`) || localStorage.getItem(`blueActionsSubmittedMove${currentMove}`);
            const actionCount = actionsData ? JSON.parse(actionsData).actions?.length || 0 : 0;
            document.getElementById('actionsBadge').textContent = actionCount;
            
            // Count rulings (session-aware)
            const sessionId = getSessionId();
            const rulingsKey = `whiteCellRulings_session_${sessionId}_move_${currentMove}`;
            let rulings = [];
            try {
                const stored = localStorage.getItem(rulingsKey) || localStorage.getItem(`whiteCellRulings_move_${currentMove}`) || localStorage.getItem('whiteCellRulings') || '[]';
                rulings = JSON.parse(stored);
            } catch (e) {
                console.error('Error loading rulings for badge:', e);
                rulings = [];
            }
            document.getElementById('adjudicationBadge').textContent = rulings.length;
            
            // Count communications (session-aware)
            const commKey = `communications_session_${sessionId}_move_${currentMove}`;
            let commLocal = [];
            try {
                const stored = safeGetItem(commKey, []) || safeGetItem(`communications_move_${currentMove}`, []);
                commLocal = Array.isArray(stored) ? stored : [];
            } catch (e) {
                console.error('Error loading communications for badge:', e);
                commLocal = [];
            }
            const commCount = commLocal.length;
            document.getElementById('communicationBadge').textContent = commCount;
        }

        function loadSubmittedRequests() {
            const container = document.getElementById('requestsContainer');
            const sessionId = getSessionId();
            // Try session-aware key first, then fallback to legacy keys
            let requestsData = safeGetItem(`blueRequests_session_${sessionId}_move_${currentMove}`, null);
            if (!requestsData) {
                requestsData = safeGetItem(`blueRequests_move_${currentMove}`, null);
            }
            if (!requestsData) {
                requestsData = safeGetItem(`blueRequestsSubmittedMove${currentMove}`, null);
            }
            
            if (!requestsData) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <p>No requests for information yet</p>
                        <p>Requests will appear here when submitted</p>
                    </div>
                `;
                return;
            }
            
            let requests = [];
            try {
                // Handle both array and object formats
                if (Array.isArray(requestsData)) {
                    requests = requestsData;
                } else if (typeof requestsData === 'object' && requestsData !== null) {
                    requests = requestsData.requests || [];
                }
            } catch (e) {
                console.error('Error parsing requests data:', e);
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <p>Error loading requests</p>
                        <p>Data may be corrupted</p>
                    </div>
                `;
                return;
            }
            
            if (requests.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <p>No requests for information yet</p>
                        <p>Requests will appear here when submitted</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = requests.map(request => `
                <div class="action-item">
                    <div class="action-header">
                        <span class="action-number">Info Request</span>
                        <span style="font-size: 0.6875rem; color: var(--color-text-muted);">${(request.categories||[]).join(', ')} - ${(request.priority||'').toString().toUpperCase()}</span>
                    </div>
                    <div style="font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px;">${request.details||request.text||''}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-muted);">
                        Submitted: ${new Date(request.timestamp||Date.now()).toLocaleString()}
                    </div>
                </div>
            `).join('');
        }

        function loadSubmittedActions() {
            const container = document.getElementById('actionsContainer');
            const sessionId = getSessionId();
            
            // Try session-aware keys first, then fallback to legacy keys
            let actionsData = null;
            try {
                actionsData = localStorage.getItem(`blueActions_session_${sessionId}_move_${currentMove}`);
                if (!actionsData) {
                    // Try to load from facilitator's action data
                    const facilitatorKey = `actions_session_${sessionId}_move_${currentMove}`;
                    const facilitatorData = localStorage.getItem(facilitatorKey);
                    if (facilitatorData) {
                        try {
                            const parsed = JSON.parse(facilitatorData);
                            if (parsed.actions && parsed.actions.length > 0) {
                                actionsData = JSON.stringify({ actions: parsed.actions });
                            }
                        } catch (e) {
                            console.error('Error parsing facilitator data:', e);
                        }
                    }
                }
                // Fallback to legacy keys
                if (!actionsData) {
                    actionsData = localStorage.getItem(`blueActions_move_${currentMove}`);
                }
                if (!actionsData) {
                    actionsData = localStorage.getItem(`blueActionsSubmittedMove${currentMove}`);
                }
            } catch (e) {
                console.error('Error loading actions:', e);
            }
            
            // Also populate action selector dropdown
            populateActionSelector();
            
            if (!actionsData) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        <p>No actions submitted yet</p>
                        <p>Actions will appear here when submitted</p>
                    </div>
                `;
                return;
            }
            
            let submission, actions = [];
            try {
                submission = JSON.parse(actionsData);
                actions = submission.actions || [];
            } catch (e) {
                console.error('Error parsing actions data:', e);
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        <p>Error loading actions</p>
                        <p>Data may be corrupted</p>
                    </div>
                `;
                return;
            }
            
            if (actions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        <p>No actions submitted yet</p>
                        <p>Actions will appear here when submitted</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = actions.map((action, index) => {
                const actionId = action.id || action.number || `action-${index}`;
                const mechanismNames = {
                    'sanctions': 'Sanctions/Financial Restrictions',
                    'export': 'Export Controls',
                    'investment': 'Investment / Capital Controls',
                    'trade': 'Trade Policy',
                    'financial': 'Financial/ Digital Asset Policy',
                    'economic': 'General Economic Statecraft/Cross-Cutting Tools',
                    'industrial': 'Industrial Policy',
                    'infrastructure': 'Infrastructure & Workforce Development/Supply-Chain Resilience'
                };
                const sectorNames = {
                    'biotechnology': 'Biotechnology',
                    'agriculture': 'Agriculture',
                    'telecommunications': 'Telecommunications'
                };
                return `
                <div class="action-item" data-action-id="${actionId}">
                    <div class="action-header">
                        <span class="action-number">Action ${action.number || index + 1}</span>
                        <span style="font-size: 0.6875rem; color: var(--color-text-muted);">${mechanismNames[action.mechanism] || action.mechanism || ''} - ${sectorNames[action.sector] || action.sector || ''}</span>
                    </div>
                    <div style="font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px;"><strong>Goal:</strong> ${action.goal || ''}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-muted);">
                        Submitted: ${new Date(action.timestamp || submission.submittedAt || Date.now()).toLocaleString()}
                    </div>
                </div>
            `;
            }).join('');
        }

        function populateActionSelector() {
            const selector = document.getElementById('adj-action-selector');
            if (!selector) return;
            
            const sessionId = getSessionId();
            let actionsData = localStorage.getItem(`blueActions_session_${sessionId}_move_${currentMove}`);
            if (!actionsData) {
                const facilitatorKey = `actions_session_${sessionId}_move_${currentMove}`;
                const facilitatorData = localStorage.getItem(facilitatorKey);
                if (facilitatorData) {
                    try {
                        const parsed = JSON.parse(facilitatorData);
                        if (parsed.actions && parsed.actions.length > 0) {
                            actionsData = JSON.stringify({ actions: parsed.actions });
                        }
                    } catch (e) {
                        console.error('Error parsing facilitator data for selector:', e);
                    }
                }
            }
            if (!actionsData) {
                actionsData = localStorage.getItem(`blueActions_move_${currentMove}`) || localStorage.getItem(`blueActionsSubmittedMove${currentMove}`);
            }
            
            // Clear existing options except the first one
            selector.innerHTML = '<option value="">-- Select an action to adjudicate --</option>';
            
            if (!actionsData) return;
            
            try {
                const submission = JSON.parse(actionsData);
                const actions = submission.actions || [];
                
                actions.forEach((action, index) => {
                    const actionId = action.id || action.number || `action-${index}`;
                    const mechanismNames = {
                        'sanctions': 'Sanctions/Financial Restrictions',
                        'export': 'Export Controls',
                        'investment': 'Investment / Capital Controls',
                        'trade': 'Trade Policy',
                        'financial': 'Financial/ Digital Asset Policy',
                        'economic': 'General Economic Statecraft/Cross-Cutting Tools',
                        'industrial': 'Industrial Policy',
                        'infrastructure': 'Infrastructure & Workforce Development/Supply-Chain Resilience'
                    };
                    const sectorNames = {
                        'biotechnology': 'Biotechnology',
                        'agriculture': 'Agriculture',
                        'telecommunications': 'Telecommunications'
                    };
                    const label = `Action ${action.number || index + 1}: ${mechanismNames[action.mechanism] || action.mechanism || 'Unknown'} - ${sectorNames[action.sector] || action.sector || 'Unknown'}`;
                    const option = document.createElement('option');
                    option.value = actionId;
                    option.textContent = label;
                    option.setAttribute('data-action-index', index);
                    selector.appendChild(option);
                });
                
                // Add event listener to display action details when selected
                selector.addEventListener('change', function() {
                    displaySelectedActionDetails(this.value, actions);
                });
            } catch (e) {
                console.error('Error populating action selector:', e);
            }
        }
        
        function displaySelectedActionDetails(actionId, actions) {
            if (!actionId || !actions || actions.length === 0) return;
            
            // Find the action
            const action = actions.find(a => 
                (a.id && a.id.toString() === actionId) || 
                (a.number && a.number.toString() === actionId) ||
                (actions.indexOf(a).toString() === actionId)
            ) || actions[parseInt(actionId) || 0];
            
            if (!action) return;
            
            // Create or update action details display
            let detailsContainer = document.getElementById('adj-action-details');
            if (!detailsContainer) {
                detailsContainer = document.createElement('div');
                detailsContainer.id = 'adj-action-details';
                detailsContainer.style.marginTop = '16px';
                detailsContainer.style.padding = '16px';
                detailsContainer.style.background = 'var(--color-bg-secondary, #f5f5f5)';
                detailsContainer.style.borderRadius = '8px';
                detailsContainer.style.border = '1px solid var(--color-border, #ddd)';
                
                const selector = document.getElementById('adj-action-selector');
                if (selector && selector.parentNode) {
                    selector.parentNode.insertBefore(detailsContainer, selector.nextSibling);
                }
            }
            
            const mechanismNames = {
                'sanctions': 'Sanctions/Financial Restrictions',
                'export': 'Export Controls',
                'investment': 'Investment / Capital Controls',
                'trade': 'Trade Policy',
                'financial': 'Financial/ Digital Asset Policy',
                'economic': 'General Economic Statecraft/Cross-Cutting Tools',
                'industrial': 'Industrial Policy',
                'infrastructure': 'Infrastructure & Workforce Development/Supply-Chain Resilience'
            };
            const sectorNames = {
                'biotechnology': 'Biotechnology',
                'agriculture': 'Agriculture',
                'telecommunications': 'Telecommunications'
            };
            const exposureNames = {
                'critical-minerals': 'Critical Minerals',
                'supply-chain': 'Supply Chain',
                'technologies': 'Technologies',
                'manufacturing': 'Manufacturing'
            };
            
            detailsContainer.innerHTML = `
                <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 1rem;">Action ${action.number || 'N/A'} Details</h4>
                <div style="font-size: 0.875rem; line-height: 1.6;">
                    <div style="margin-bottom: 8px;"><strong>Mechanism:</strong> ${mechanismNames[action.mechanism] || action.mechanism || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Sector:</strong> ${sectorNames[action.sector] || action.sector || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Targets:</strong> ${(action.targets || []).join(', ').toUpperCase() || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Type of Exposure:</strong> ${exposureNames[action.exposure] || action.exposure || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Goal:</strong> ${action.goal || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Expected Outcomes:</strong> ${action.outcomes || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Ally Contingencies:</strong> ${action.contingencies || 'N/A'}</div>
                </div>
            `;
        }

        // Rulings
        async function addRuling() {
            const subject = document.getElementById('rulingSubject').value.trim();
            const ruling = document.getElementById('rulingText').value.trim();
            const rationale = document.getElementById('rulingRationale').value.trim();
            
            if (!subject || !ruling) {
                alert('Please fill in subject and ruling');
                return;
            }
            
            const rulingRecord = {
                subject: subject,
                ruling: ruling,
                rationale: rationale,
                time: new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                move: currentMove
            };
            
            // Save to localStorage (session-aware)
            const sessionId = getSessionId();
            const rulingsKey = `whiteCellRulings_session_${sessionId}_move_${currentMove}`;
            let rulings = [];
            try {
                const stored = localStorage.getItem(rulingsKey) || localStorage.getItem(`whiteCellRulings_move_${currentMove}`) || '[]';
                rulings = JSON.parse(stored);
            } catch (e) {
                console.error('Error loading rulings:', e);
                rulings = [];
            }
            rulings.push(rulingRecord);
            try {
                localStorage.setItem(rulingsKey, JSON.stringify(rulings));
            } catch (e) {
                console.error('Error saving ruling:', e);
                alert('Failed to save ruling. Browser storage may be full.');
                return;
            }

            // Append canonical timeline event
            appendTimelineItem(getSessionId(), currentMove, {
                phase: 'adjudication',
                type: 'ruling',
                title: `Ruling: ${subject}`,
                content: ruling,
                team: 'white',
                refs: { rationale }
            });
            
            displayRulingLog();
            updateBadges();
            
            document.getElementById('rulingSubject').value = '';
            document.getElementById('rulingText').value = '';
            document.getElementById('rulingRationale').value = '';
        }

        async function displayRulingLog() {
            const container = document.getElementById('rulingLogContainer');
            
            try {
                // Load from localStorage (session-aware)
                const sessionId = getSessionId();
                const rulingsKey = `whiteCellRulings_session_${sessionId}_move_${currentMove}`;
                let localRulings = [];
                try {
                    const stored = localStorage.getItem(rulingsKey) || localStorage.getItem(`whiteCellRulings_move_${currentMove}`) || localStorage.getItem('whiteCellRulings') || '[]';
                    localRulings = JSON.parse(stored);
                } catch (e) {
                    console.error('Error parsing rulings:', e);
                    localRulings = [];
                }
                const rulings = localRulings.filter(r => r.move === currentMove || !r.move);
                
                if (rulings.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            <p>No rulings recorded yet</p>
                            <p>Rulings will appear here as they are made</p>
                        </div>
                    `;
                } else {
                    container.innerHTML = rulings.map(r => `
                        <div class="action-item">
                            <div class="action-header">
                                <span class="action-number">${r.subject}</span>
                                <span style="font-size: 0.6875rem; color: var(--color-text-muted);">${r.time}</span>
                            </div>
                            <div style="font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px;">${r.ruling}</div>
                            ${r.rationale ? `<div style="font-size: 0.75rem; color: var(--color-text-muted); font-style: italic;">Rationale: ${r.rationale}</div>` : ''}
                        </div>
                    `).reverse().join('');
                }
            } catch (error) {
                console.error('Error loading rulings:', error);
                // Fallback to localStorage (session-aware)
                const sessionId = getSessionId();
                const rulingsKey = `whiteCellRulings_session_${sessionId}_move_${currentMove}`;
                let rulings = [];
                try {
                    const stored = localStorage.getItem(rulingsKey) || localStorage.getItem(`whiteCellRulings_move_${currentMove}`) || localStorage.getItem('whiteCellRulings') || '[]';
                    rulings = JSON.parse(stored);
                } catch (e) {
                    console.error('Error parsing rulings in fallback:', e);
                    rulings = [];
                }
                rulings = rulings.filter(r => r.move === currentMove || !r.move);
                
                if (rulings.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            <p>No rulings recorded yet</p>
                            <p>Rulings will appear here as they are made</p>
                        </div>
                    `;
                } else {
                    container.innerHTML = rulings.map(r => `
                        <div class="action-item">
                            <div class="action-header">
                                <span class="action-number">${r.subject}</span>
                                <span style="font-size: 0.6875rem; color: var(--color-text-muted);">${r.time}</span>
                            </div>
                            <div style="font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px;">${r.ruling}</div>
                            ${r.rationale ? `<div style="font-size: 0.75rem; color: var(--color-text-muted); font-style: italic;">Rationale: ${r.rationale}</div>` : ''}
                        </div>
                    `).reverse().join('');
                }
            }
        }

        // Adjudication submission
        async function submitAdjudication() {
            try {
                // Get selected action ID
                const actionSelector = document.getElementById('adj-action-selector');
                const selectedActionId = actionSelector ? actionSelector.value : '';
                
                if (!selectedActionId) {
                    alert('Please select an action to adjudicate.');
                    return;
                }
                
                const data = {
                    actionId: selectedActionId,
                    vulnerabilities: Array.from(document.querySelectorAll('.adj-vulnerability:checked')).map(cb => cb.value),
                    interdependencies: {},
                    structuralImpacts: {},
                    outcome: document.querySelector('[name="adj-outcome"]:checked')?.value,
                    narrative: document.getElementById('adj-narrative')?.value,
                    timestamp: new Date().toISOString(),
                    move: currentMove,
                    phase: currentPhase
                };
                
                // Collect interdependencies
                ['Ally-to-Ally', 'Ally-to-Adversary', 'Adversary Internal'].forEach(rel => {
                    const impactSelect = document.querySelector(`[data-rel="${rel}"].adj-impact-nature`);
                    const nameMap = {
                        'Ally-to-Ally': 'sev-ally-ally',
                        'Ally-to-Adversary': 'sev-ally-adv',
                        'Adversary Internal': 'sev-adv-int'
                    };
                    const severityRadio = document.querySelector(`[name="${nameMap[rel]}"]:checked`);
                    if (impactSelect || severityRadio) {
                        data.interdependencies[rel] = {
                            impact: impactSelect?.value || '',
                            severity: severityRadio?.value || ''
                        };
                    }
                });
                
                // Collect structural impacts
                const tracks = ['Technological Edge', 'Industrial & Production Base', 'Supply-Chain Resilience', 
                               'Alliance System & Coordination', 'Operational Window', 'Economic & Political Shock Exposure'];
                tracks.forEach(track => {
                    const blueSelect = document.querySelector(`[data-track="${track}"].adj-blue-pos`);
                    const redSelect = document.querySelector(`[data-track="${track}"].adj-red-traj`);
                    const advSelect = document.querySelector(`[data-track="${track}"].adj-net-adv`);
                    if (blueSelect || redSelect || advSelect) {
                        data.structuralImpacts[track] = {
                            blueEffect: blueSelect?.value || '',
                            redEffect: redSelect?.value || '',
                            advantage: advSelect?.value || ''
                        };
                    }
                });
                
                // Validate required fields
                if (!data.outcome || !data.narrative || data.narrative.trim() === '') {
                    alert('Please select an outcome and provide a narrative.');
                    return;
                }
                
                // Validate at least one vulnerability is selected
                if (data.vulnerabilities.length === 0) {
                    alert('Please select at least one vulnerability.');
                    return;
                }
                
                // Validate structural impacts - at least one track should have data
                const hasStructuralImpact = Object.keys(data.structuralImpacts).some(track => {
                    const impact = data.structuralImpacts[track];
                    return impact.blueEffect || impact.redEffect || impact.advantage;
                });
                if (!hasStructuralImpact) {
                    if (!confirm('No structural impacts selected. Continue anyway?')) {
                        return;
                    }
                }
                
                // Save to localStorage (session-aware)
                const sessionIdForAdj = getSessionId();
                const key = `adjudications_session_${sessionIdForAdj}_move_${currentMove}`;
                let existing = [];
                try {
                    const stored = localStorage.getItem(key) || localStorage.getItem(`adjudications_move_${currentMove}`) || '[]';
                    existing = JSON.parse(stored);
                } catch (e) {
                    console.error('Error loading adjudications:', e);
                    existing = [];
                }
                existing.push(data);
                try {
                    localStorage.setItem(key, JSON.stringify(existing));
                } catch (e) {
                    console.error('Error saving adjudication:', e);
                    if (e.name === 'QuotaExceededError') {
                        alert('Browser storage is full. Please clear some data or use a different browser.');
                    } else {
                        alert('Failed to save adjudication. Please try again.');
                    }
                    return;
                }
                
                // Also add a simple ruling entry for the log
                const rulingRecord = {
                    subject: `Adjudication: ${data.outcome}`,
                    ruling: data.narrative.substring(0, 200) + (data.narrative.length > 200 ? '...' : ''),
                    rationale: `Structural impacts and interdependencies assessed. Outcome: ${data.outcome}`,
                    time: new Date().toLocaleTimeString(),
                    timestamp: Date.now(),
                    move: currentMove
                };
                // Save ruling with session-aware key
                const rulingsKey = `whiteCellRulings_session_${sessionIdForAdj}_move_${currentMove}`;
                let rulings = [];
                try {
                    const stored = localStorage.getItem(rulingsKey) || localStorage.getItem(`whiteCellRulings_move_${currentMove}`) || '[]';
                    rulings = JSON.parse(stored);
                } catch (e) {
                    console.error('Error loading rulings:', e);
                    rulings = [];
                }
                rulings.push(rulingRecord);
                try {
                    localStorage.setItem(rulingsKey, JSON.stringify(rulings));
                } catch (e) {
                    console.error('Error saving ruling:', e);
                    alert('Failed to save ruling. Browser storage may be full.');
                    return;
                }
                
                // Update ruling log
                await displayRulingLog();
                updateBadges();
                
                showToast('Adjudication saved successfully');
                
                // Clear form (optional - comment out if you want to keep data)
                document.getElementById('adj-narrative').value = '';
                document.querySelectorAll('.adj-vulnerability:checked').forEach(cb => cb.checked = false);
                document.querySelectorAll('[name="adj-outcome"]:checked').forEach(rb => rb.checked = false);
                document.querySelectorAll('.adj-impact-nature').forEach(sel => sel.value = '');
                document.querySelectorAll('[name^="sev-"]:checked').forEach(rb => rb.checked = false);
                document.querySelectorAll('.adj-blue-pos, .adj-red-traj, .adj-net-adv').forEach(sel => sel.value = '');
                
            } catch (error) {
                console.error('Error saving adjudication:', error);
                alert('Failed to save adjudication. Please try again.');
            }
        }

        // Communication
        async function sendResponseToBlue() {
            const type = document.getElementById('responseType').value;
            const title = document.getElementById('responseTitle').value.trim();
            const content = document.getElementById('responseContent').value.trim();
            
            if (!title || !content) {
                alert('Please fill in both title and content.');
                return;
            }
            
            const response = {
                type: type,
                title: title,
                content: content,
                move: currentMove,
                timestamp: new Date().toISOString(),
                respondedAt: new Date().toISOString(),
                from: 'WHITE Cell',
                to: 'BLUE Team'
            };
            
            // Save to localStorage (session-aware)
            const sessionId = getSessionId();
            const commKey = `communications_session_${sessionId}_move_${currentMove}`;
            let arr = [];
            try {
                arr = safeGetItem(commKey, []) || safeGetItem(`communications_move_${currentMove}`, []);
                if (!Array.isArray(arr)) arr = [];
            } catch (e) {
                console.error('Error loading communications:', e);
                arr = [];
            }
            arr.push(response);
            try {
                safeSetItem(commKey, arr);
            } catch (e) {
                console.error('Error saving communication:', e);
                if (e.name === 'QuotaExceededError') {
                    alert('Browser storage is full. Please clear some data or use a different browser.');
                } else {
                    alert('Failed to save communication. Please try again.');
                }
                return;
            }

            // Append canonical timeline event
            appendTimelineItem(getSessionId(), currentMove, {
                phase: 'adjudication',
                type: 'white_feedback',
                title: response.title,
                content: response.content,
                team: 'white',
                refs: { to: 'blue' }
            });
            
            document.getElementById('responseTitle').value = '';
            document.getElementById('responseContent').value = '';
            
            displayCommunicationLog();
            updateBadges();
            
            alert('Response sent to BLUE Team!');
        }

        async function displayCommunicationLog() {
            const container = document.getElementById('communicationLogContainer');
            
            try {
                // Load from localStorage (session-aware)
                const sessionId = getSessionId();
                const commKey = `communications_session_${sessionId}_move_${currentMove}`;
                let responses = [];
                try {
                    responses = safeGetItem(commKey, []) || safeGetItem(`communications_move_${currentMove}`, []);
                    if (!Array.isArray(responses)) responses = [];
                } catch (e) {
                    console.error('Error parsing communications:', e);
                    responses = [];
                }
                
                if (responses.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <p>No communications sent yet</p>
                            <p>Messages will appear here when sent</p>
                        </div>
                    `;
                    return;
                }
                
                container.innerHTML = responses.map(response => `
                    <div class="action-item">
                        <div class="action-header">
                            <span class="action-number">${response.title}</span>
                            <span style="font-size: 0.6875rem; color: var(--color-text-muted);">${response.type.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <div style="font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px;">${response.content}</div>
                        <div style="font-size: 0.75rem; color: var(--color-text-muted);">
                            Sent to BLUE Team - Move ${response.move} - ${new Date(response.timestamp).toLocaleString()}
                        </div>
                    </div>
                `).reverse().join('');
            } catch (error) {
                console.error('Error loading communications:', error);
                // Fallback to localStorage (session-aware)
                const sessionId = getSessionId();
                const commKey = `communications_session_${sessionId}_move_${currentMove}`;
                let responses = [];
                try {
                    responses = safeGetItem(commKey, []) || safeGetItem(`communications_move_${currentMove}`, []);
                    if (!Array.isArray(responses)) responses = [];
                } catch (e) {
                    console.error('Error parsing communications in fallback:', e);
                    responses = [];
                }
                
                if (responses.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <p>No communications sent yet</p>
                            <p>Messages will appear here when sent</p>
                        </div>
                    `;
                    return;
                }
                
                container.innerHTML = responses.map(response => `
                    <div class="action-item">
                        <div class="action-header">
                            <span class="action-number">${response.title}</span>
                            <span style="font-size: 0.6875rem; color: var(--color-text-muted);">${response.type.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <div style="font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px;">${response.content}</div>
                        <div style="font-size: 0.75rem; color: var(--color-text-muted);">
                            Sent to BLUE Team - Move ${response.move} - ${new Date(response.timestamp).toLocaleString()}
                        </div>
                    </div>
                `).reverse().join('');
            }
        }

        // Save/Load
        async function saveData() {
            try {
                const data = {
                    timestamp: new Date().toISOString(),
                    timerRemaining: timerSeconds,
                    timelineItems: timelineItems,
                    currentPhase: currentPhase,
                    move: currentMove
                };
                
                document.querySelectorAll('input, textarea, select').forEach(el => {
                    if (el.id && el.id !== 'moveSelector') data[el.id] = el.value;
                });
                
                // Save to localStorage (session-aware)
                const sessionId = getSessionId();
                safeSetItem(`whiteCell_session_${sessionId}_move_${currentMove}`, data);
                
                // Also save timer state to shared location
                saveTimerState();
                
                // Auto-save to data_storage folder (throttled - only every 30 seconds)
                if (typeof autoSaveWhiteCellData === 'function') {
                    const lastSave = localStorage.getItem(`lastAutoSave_whitecell_${sessionId}_${currentMove}`);
                    const now = Date.now();
                    if (!lastSave || (now - parseInt(lastSave)) > 30000) {
                        autoSaveWhiteCellData(sessionId, currentMove);
                        localStorage.setItem(`lastAutoSave_whitecell_${sessionId}_${currentMove}`, now.toString());
                    }
                }
            } catch (e) {
                console.error('Failed to save data', e);
                if (e.name === 'QuotaExceededError') {
                    alert('Browser storage is full. Please clear some data or use a different browser.');
                } else {
                    console.error('Unexpected error saving data:', e);
                }
                showToast('Error saving data');
            }
        }

        async function loadData() {
            // Load from localStorage with validation (session-aware)
            const sessionId = getSessionId();
            let saved = safeGetItem(`whiteCell_session_${sessionId}_move_${currentMove}`, null);
            // Fallback to legacy key for migration
            if (!saved) {
                saved = safeGetItem(`whiteCell_move_${currentMove}`, null);
                // Migrate if legacy data found
                if (saved) {
                    safeSetItem(`whiteCell_session_${sessionId}_move_${currentMove}`, saved);
                }
            }
            if (saved) {
                const data = saved;
                
                // Validate data structure with strict validation
                const schema = {
                    timelineItems: { type: 'array', required: false, default: [] },
                    currentPhase: { type: 'number', required: false, default: 1 },
                    move: { type: 'number', required: false },
                    timestamp: { type: 'string', required: false }
                };
                
                const validated = validateDataStrict(data, schema, false);
                if (!validated) {
                    console.warn('Data validation failed, using empty data');
                    showToast('Data validation failed - some data may be missing');
                    data = { timelineItems: [], currentPhase: 1 };
                } else {
                    data = validated;
                }
                
                Object.keys(data).forEach(key => {
                    const el = document.getElementById(key);
                    if (el && key !== 'moveSelector') el.value = data[key];
                });
                
                if (data.timelineItems) {
                    timelineItems = data.timelineItems;
                    updateTimeline();
                    updateBadges();
                }
                
                // Timer state is loaded from shared storage via loadTimerState()
                // Don't override with local save data

                if (data.currentPhase) {
                    currentPhase = data.currentPhase;
                    document.querySelectorAll('.phase-btn').forEach(btn => {
                        const isActive = parseInt(btn.getAttribute('data-phase')) === currentPhase;
                        btn.classList.toggle('active', isActive);
                    });
                    updatePhaseGuidance();
                }
            }
            
            displayRulingLog();
            displayCommunicationLog();
        }

        function exportNotes() {
            try {
                const sessionId = getSessionId();
                const moves = {};
                for (let i = 1; i <= 3; i++) {
                    // Try session-aware key first, then legacy
                    const data = safeGetItem(`whiteCell_session_${sessionId}_move_${i}`, null) || 
                                safeGetItem(`whiteCell_move_${i}`, null);
                    if (data) moves[i] = data;
                }
                
                // Collect all rulings for all moves
                const allRulings = [];
                for (let i = 1; i <= 3; i++) {
                    const rulings = safeGetItem(`whiteCellRulings_session_${sessionId}_move_${i}`, []) ||
                                   safeGetItem(`whiteCellRulings_move_${i}`, []);
                    if (Array.isArray(rulings)) {
                        allRulings.push(...rulings);
                    }
                }
                // Also check legacy global key
                const legacyRulings = safeGetItem('whiteCellRulings', []);
                if (Array.isArray(legacyRulings)) {
                    allRulings.push(...legacyRulings);
                }
                
                // Collect all communications for all moves
                const allCommunications = [];
                for (let i = 1; i <= 3; i++) {
                    // Get communications from session-aware key
                    const commKey = `communications_session_${sessionId}_move_${i}`;
                    const comms = safeGetItem(commKey, []) || safeGetItem(`communications_move_${i}`, []);
                    if (Array.isArray(comms)) {
                        allCommunications.push(...comms);
                    }
                    
                    // Also include feedback entries
                    const feedbackKey = `whiteCellFeedback_session_${sessionId}_move_${i}`;
                    const feedback = safeGetItem(feedbackKey, []);
                    if (Array.isArray(feedback)) {
                        feedback.forEach(f => allCommunications.push({ 
                            title: f.summary, 
                            type: 'white_feedback', 
                            content: f.notes || '', 
                            move: f.move, 
                            timestamp: f.timestamp 
                        }));
                    }
                }
                
                // Collect all adjudications
                const allAdjudications = [];
                for (let i = 1; i <= 3; i++) {
                    const adj = safeGetItem(`adjudications_session_${sessionId}_move_${i}`, []) ||
                               safeGetItem(`adjudications_move_${i}`, []);
                    if (Array.isArray(adj)) {
                        allAdjudications.push(...adj);
                    }
                }
                
                const exportData = {
                    exported: new Date().toISOString(),
                    exportedBy: 'WHITE Cell Control',
                    sessionId: sessionId,
                    currentMove: currentMove,
                    currentPhase: currentPhase,
                    allMoves: moves,
                    rulings: allRulings,
                    communications: allCommunications,
                    adjudications: allAdjudications,
                    decisionTimeline: buildDecisionTimeline(moves)
                };
                
                if (Object.keys(moves).length === 0 && allRulings.length === 0 && allCommunications.length === 0) {
                    alert('No data to export. Please add some data first.');
                    return;
                }
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
                a.download = `WHITE_Cell_Session_${sessionId}_${timestamp}.json`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showToast('Data exported successfully');
            } catch (error) {
                console.error('Error exporting data:', error);
                alert(`Error exporting data: ${error.message || 'Unknown error'}`);
                showToast('Export failed');
            }
        }
        
        // Make function globally available
        window.exportNotes = exportNotes;

        function buildDecisionTimeline(moves) {
            const timeline = [];
            for (let move in moves) {
                const data = moves[move];
                if (data.timelineItems) {
                    data.timelineItems.forEach(item => {
                        timeline.push({
                            move: move,
                            time: item.time,
                            phase: item.phase,
                            type: item.type,
                            content: item.content
                        });
                    });
                }
            }
            return timeline;
        }

        function submitNotes() {
            saveData();
            const sessionId = getSessionId();
            const data = safeGetItem(`whiteCell_session_${sessionId}_move_${currentMove}`, null) ||
                        safeGetItem(`whiteCell_move_${currentMove}`, null);
            if (!data) {
                alert('No data to finalize');
                return;
            }
            
            const timelineCount = data.timelineItems?.length || 0;
            const rulings = safeGetItem(`whiteCellRulings_session_${sessionId}_move_${currentMove}`, []) ||
                           safeGetItem(`whiteCellRulings_move_${currentMove}`, []) ||
                           safeGetItem('whiteCellRulings', []);
            const feedback = safeGetItem(`whiteCellFeedback_session_${sessionId}_move_${currentMove}`, []);
            
            let summary = `Finalize Move ${currentMove}?\n\n`;
            summary += `Timeline items: ${timelineCount}\n`;
            summary += `Rulings recorded: ${rulings.length}\n`;
            summary += `Communications sent: ${feedback.length}\n\n`;
            summary += `This will mark the move as complete.`;
            
            if (confirm(summary)) {
                data.finalized = true;
                data.finalizedAt = new Date().toISOString();
                safeSetItem(`whiteCell_session_${sessionId}_move_${currentMove}_finalized`, data);
                
                const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `WHITE_Cell_Move${currentMove}_Finalized_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                
                alert(`Move ${currentMove} finalized.\n\nFinalization file downloaded for your records.`);
            }
        }

        function resetAllLocalStorage() {
            if (!confirm('Clear all stored data for the WHITE Cell? This cannot be undone.')) return;
            const currentSessionId = getSessionId();
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // Legacy non-session keys
                const isLegacy = /^(whiteCell|blueMove|greenMove|redMove)/i.test(key);
                // Session-scoped keys for current session
                const isSessionScoped = (
                    key.startsWith(`whiteCell_session_${sessionId}_move_`) ||
                    key.startsWith(`whiteCellFeedback_session_${sessionId}_move_`) ||
                    key.startsWith(`whiteCellRulings_session_${sessionId}`) ||
                    // Team submissions (legacy)
                    /^blueActionsSubmittedMove\d+$/i.test(key) ||
                    /^blueRequestsSubmittedMove\d+$/i.test(key) ||
                    /^greenMove\d+Submitted$/i.test(key) ||
                    /^redMove\d+Submitted$/i.test(key) ||
                    // Team submissions (session-aware, if present)
                    key.startsWith(`blueActions_session_${sessionId}_move_`) ||
                    key.startsWith(`blueRequests_session_${sessionId}_move_`) ||
                    key.startsWith(`greenActions_session_${sessionId}_move_`) ||
                    key.startsWith(`redActions_session_${sessionId}_move_`) ||
                    key.startsWith(`greenRequests_session_${sessionId}_move_`) ||
                    key.startsWith(`redRequests_session_${sessionId}_move_`)
                );
                if (isLegacy || isSessionScoped) keysToRemove.push(key);
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            timelineItems = [];
            updateTimeline();
            updateBadges();
            timerSeconds = 90 * 60;
            updateTimer();
            currentPhase = 1;
            document.querySelectorAll('.phase-btn').forEach(btn => {
                const isActive = parseInt(btn.getAttribute('data-phase')) === currentPhase;
                btn.classList.toggle('active', isActive);
            });
            updatePhaseGuidance();
            document.getElementById('moveSelector').value = '1';
            currentMove = 1;
            document.getElementById('moveEpoch').textContent = moveEpochs[currentMove];
            document.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.id && el.id !== 'moveSelector') el.value = '';
            });

            alert('All local data cleared. The page will now reload.');
            location.reload();
        }

        // Initialize
        loadTimerState(); // Load timer state from shared storage
        updatePhaseGuidance();
        loadData(); // This is now async
        updateBadges();
        populateActionSelector(); // Populate action selector on load
        setInterval(saveData, 30000);
        // Synchronous save on beforeunload (guaranteed to complete)
        window.addEventListener('beforeunload', () => {
            try {
                const sessionId = getSessionId();
                const data = {
                    timestamp: new Date().toISOString(),
                    timerRemaining: timerSeconds,
                    timelineItems: timelineItems,
                    currentPhase: currentPhase,
                    move: currentMove
                };
                
                // Collect form data synchronously
                document.querySelectorAll('input, textarea, select').forEach(el => {
                    if (el.id && el.id !== 'moveSelector') data[el.id] = el.value;
                });
                
                // Synchronous localStorage write
                const key = `whiteCell_session_${sessionId}_move_${currentMove}`;
                localStorage.setItem(key, JSON.stringify(data));
                
                // Also save timer state synchronously
                const timerState = {
                    seconds: timerSeconds,
                    running: timerRunning,
                    lastUpdate: Date.now()
                };
                localStorage.setItem(`sharedTimer_session_${sessionId}`, JSON.stringify(timerState));
            } catch (e) {
                console.error('Error in beforeunload save:', e);
            }
        });
        
        // Auto-refresh timeline data every 5 seconds
        setInterval(() => {
            const timelineSection = document.getElementById('timeline');
            if (timelineSection && timelineSection.classList.contains('active')) {
                updateTimeline();
                updateBadges();
            }
            // Also refresh action selector periodically
            const adjSection = document.getElementById('adjudication');
            if (adjSection && adjSection.classList.contains('active')) {
                populateActionSelector();
            }
        }, 5000);

        // Listen for storage changes for cross-window/tab updates
        window.addEventListener('storage', (e) => {
            if (e.key === '_timelineUpdate' && e.newValue) {
                try {
                    const broadcast = JSON.parse(e.newValue);
                    if (broadcast.moveNumber === currentMove) {
                        const item = {
                            ...broadcast.item,
                            team: broadcast.team
                        };
                        timelineItems.push(item);
                        updateTimeline();
                        updateBadges();
                    }
                } catch (err) {
                    console.error('Failed to parse timeline update:', err);
                }
            }
            // Also listen for game state changes
            if (e.key === getSharedGameStateKey() && e.newValue) {
                try {
                    const gameState = JSON.parse(e.newValue);
                    if (gameState.move && gameState.move !== currentMove) {
                        currentMove = gameState.move;
                        document.getElementById('moveSelector').value = currentMove;
                        document.getElementById('moveEpoch').textContent = moveEpochs[currentMove];
                        loadData();
                    }
                    if (gameState.phase && gameState.phase !== currentPhase) {
                        currentPhase = gameState.phase;
                        document.querySelectorAll('.phase-btn').forEach(btn => {
                            const isActive = parseInt(btn.getAttribute('data-phase')) === currentPhase;
                            btn.classList.toggle('active', isActive);
                        });
                        updatePhaseGuidance();
                    }
                } catch (err) {
                    console.error('Failed to parse game state update:', err);
                }
            }
        });
        
        // Listen for game state updates via custom events (for same-window updates)
        window.addEventListener('gameStateUpdated', (e) => {
            const gameState = e.detail;
            if (gameState.move && gameState.move !== currentMove) {
                currentMove = gameState.move;
                document.getElementById('moveSelector').value = currentMove;
                document.getElementById('moveEpoch').textContent = moveEpochs[currentMove];
                loadData();
            }
            if (gameState.phase && gameState.phase !== currentPhase) {
                currentPhase = gameState.phase;
                document.querySelectorAll('.phase-btn').forEach(btn => {
                    const isActive = parseInt(btn.getAttribute('data-phase')) === currentPhase;
                    btn.classList.toggle('active', isActive);
                });
                updatePhaseGuidance();
            }
        });

        // Standardized loader hide
        window.addEventListener('load', function() {
            setTimeout(function() {
                const loader = document.getElementById('loader');
                if (loader && !loader.classList.contains('hidden')) {
                    loader.classList.add('hidden');
                }
            }, 1500);
        });

        // Use shared mapPhaseEnum and appendTimelineItem from utils.js

        // Session picker init - White Cell controls session
        (function initSessionPicker(){
            const input = document.getElementById('sessionInput');
            const apply = document.getElementById('sessionApply');
            const current = getSessionId();
            if (input) input.value = current;
            if (apply) apply.addEventListener('click', () => {
                const val = (input.value||'').trim();
                if (val) { 
                    localStorage.setItem('currentSessionId', val);
                    saveGameState(); // Save to shared storage
                    showToast(`Session set to ${val}`);
                    loadData();
                    updateBadges();
                } else {
                    showToast('Please enter a session ID');
                }
            });
        })();
        
        // Initialize game state on load
        saveGameState();