        // Use shared getSessionId from utils.js
        // Migrate data on load
        if (typeof migrateData === 'function') {
            migrateData(getSessionId());
        }

        // Basic functionality for the facilitator platform
        let currentMove = 1;
        const moveEpochs = {
            1: 'Move 1: Epoch 1 (2027-2030)',
            2: 'Move 2: Epoch 2 (2030-2032)',
            3: 'Move 3: Epoch 3 (2032-2034)'
        };

        let currentPhase = 1;
        let actions = [];
        let infoRequests = [];
        let observations = [];
        let whiteResponses = [];

        // Read-only move, phase, and session - controlled by White Cell
        function getSharedGameStateKey() {
            const sessionId = getSessionId();
            return `sharedGameState_session_${sessionId}`;
        }
        
        function updateGameStateFromShared() {
            const gameState = safeGetItem(getSharedGameStateKey(), null);
            if (gameState) {
                // Update move
                if (gameState.move && gameState.move !== currentMove) {
                    currentMove = gameState.move;
                    const moveSelector = document.getElementById('moveSelector');
                    if (moveSelector) {
                        moveSelector.value = currentMove;
                        document.getElementById('moveEpoch').textContent = moveEpochs[currentMove];
                        document.getElementById('whiteResponsesMove').textContent = currentMove;
                        loadData();
                        loadWhiteResponses();
                    }
                }
                
                // Update phase
                if (gameState.phase && gameState.phase !== currentPhase) {
                    currentPhase = gameState.phase;
                    document.querySelectorAll('.phase-btn').forEach(btn => {
                        if (parseInt(btn.getAttribute('data-phase')) === currentPhase) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                    updatePhaseGuidance();
                }
                
                // Update session (if changed)
                if (gameState.sessionId && gameState.sessionId !== getSessionId()) {
                    localStorage.setItem('currentSessionId', gameState.sessionId);
                    // Reload data for new session
                    loadData();
                }
            }
        }
        
        function changeMoveContext() {
            // Disabled - move is controlled by White Cell
            showToast('Move changes are controlled by White Cell');
            updateGameStateFromShared();
        }

        function updatePhaseGuidance() {
            const container = document.getElementById('phaseGuidanceContainer');
            const guidance = {
                1: "Phase 1: Internal Deliberation — Facilitate BLUE Team discussions and decision-making",
                2: "Phase 2: Alliance Consultation — Coordinate with external parties and WHITE Cell",
                3: "Phase 3: Finalization — Help finalize decisions and prepare for adjudication",
                4: "Phase 4: Adjudication — Process WHITE Cell feedback and results",
                5: "Phase 5: Results Brief — Present outcomes and lessons learned"
            };
            container.innerHTML = `
                <div class="phase-guidance">
                    <strong>Current Phase ${currentPhase}</strong>
                    ${guidance[currentPhase]}
                </div>
            `;
        }

        // Phase buttons - read-only, controlled by White Cell
        document.querySelectorAll('.phase-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showToast('Phase changes are controlled by White Cell');
                updateGameStateFromShared();
            });
        });
        
        // Disable phase buttons visually
        function disablePhaseButtons() {
            document.querySelectorAll('.phase-btn').forEach(btn => {
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
            });
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', disablePhaseButtons);
        } else {
            disablePhaseButtons();
        }

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                const sectionId = item.getAttribute('data-section');
                document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
                document.getElementById(sectionId).classList.add('active');
                
                // Update timeline when timeline section is opened
                if (sectionId === 'timeline') {
                    updateTimeline();
                }
            });
        });

        // Category checkboxes for info requests
        document.querySelectorAll('.category-checkbox').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
            });
        });

        // Target checkboxes for actions
        document.querySelectorAll('.target-checkbox').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
            });
        });

        // Info Requests management
        function addInfoRequest() {
            const priority = document.getElementById('requestPriority').value;
            const details = document.getElementById('requestDetails').value.trim();
            
            if (!priority || !details) {
                alert('Please select a priority and provide request details.');
                return;
            }

            const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox.selected'))
                .map(btn => btn.getAttribute('data-category'));

            if (selectedCategories.length === 0) {
                alert('Please select at least one category.');
                return;
            }

            const request = {
                id: Date.now(),
                priority: priority,
                categories: selectedCategories,
                details: details,
                phase: currentPhase,
                timestamp: new Date().toLocaleString(),
                status: 'pending'
            };

            infoRequests.push(request);
            updateRequestsDisplay();
            updateTimeline(); // Update timeline when request is added
            
            // Reset form
            document.getElementById('requestPriority').value = '';
            document.getElementById('requestDetails').value = '';
            document.querySelectorAll('.category-checkbox').forEach(btn => btn.classList.remove('selected'));
            
            // Persist to LocalStorage for WHITE/Notetaker visibility (session-aware key)
            try {
                const sessionId = getSessionId();
                // Use session-aware key as primary
                const keySession = `blueRequests_session_${sessionId}_move_${currentMove}`;
                let arrSession = [];
                try {
                    const existingSession = localStorage.getItem(keySession);
                    arrSession = existingSession ? JSON.parse(existingSession) : [];
                } catch (e) {
                    console.error('Error loading existing requests:', e);
                    arrSession = [];
                }
                arrSession.push({
                    id: request.id,
                    priority: request.priority,
                    categories: request.categories,
                    details: request.details,
                    phase: request.phase,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem(keySession, JSON.stringify(arrSession));
                
                // Also write to move-only key for backward compatibility during transition
                const keySimple = `blueRequests_move_${currentMove}`;
                try {
                    localStorage.setItem(keySimple, JSON.stringify(arrSession));
                } catch (e) {
                    console.warn('Could not write to legacy key, continuing with session key only:', e);
                }
            } catch(e) {
                console.error('Failed to persist blue requests', e);
                if (e.name === 'QuotaExceededError') {
                    alert('Browser storage is full. Please clear some data or use a different browser.');
                } else {
                    alert('Failed to save request. Please try again.');
                }
                showToast('Error saving request');
            }

            saveData();
        }

        // Ensure global availability for inline onclick usage
        window.addInfoRequest = addInfoRequest;

        function updateRequestsDisplay() {
            const container = document.getElementById('pendingRequests');
            if (infoRequests.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <p>No information requests yet</p>
                        <p>Requests will appear here when submitted</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = infoRequests.map(request => `
                <div class="action-item" data-request-id="${request.id}">
                    <div class="action-header">
                        <span class="action-number">Request ${infoRequests.indexOf(request) + 1}</span>
                        <span class="priority-${request.priority}">${request.priority.toUpperCase()}</span>
                        <span>${request.timestamp}</span>
                        <div style="display: flex; gap: 8px; margin-left: auto;">
                            <button onclick="deleteRequest(${request.id})" style="padding: 4px 8px; font-size: 0.75rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                        </div>
                    </div>
                    <div><strong>Categories:</strong> ${request.categories.join(', ')}</div>
                    <div><strong>Details:</strong> ${request.details}</div>
                </div>
            `).join('');
        }

        // Actions management
        function addAction() {
            const mechanism = document.getElementById('actionMechanism').value;
            const sector = document.getElementById('actionSector').value;
            const goal = document.getElementById('actionGoal').value.trim();
            const outcomes = document.getElementById('actionOutcomes').value.trim();
            const contingencies = document.getElementById('actionContingencies').value.trim();
            const exposure = document.getElementById('actionExposure').value;

            if (!mechanism || !sector || !goal || !outcomes || !contingencies || !exposure) {
                alert('Please fill in all required fields.');
                return;
            }

            const selectedTargets = Array.from(document.querySelectorAll('.target-checkbox.selected'))
                .map(btn => btn.getAttribute('data-target'));

            if (selectedTargets.length === 0) {
                alert('Please select at least one target.');
                return;
            }

            const action = {
                id: Date.now(),
                number: actions.length + 1, // Will be re-sequenced if needed
                mechanism: mechanism,
                sector: sector,
                targets: selectedTargets,
                exposure: exposure,
                goal: goal,
                outcomes: outcomes,
                contingencies: contingencies,
                phase: currentPhase, // Store as number
                timestamp: new Date().toLocaleString()
            };

            actions.push(action);
            updateActionsDisplay();
            updateTimeline(); // Update timeline when action is added

            // Reset form
            document.getElementById('actionMechanism').value = '';
            document.getElementById('actionSector').value = '';
            document.getElementById('actionExposure').value = '';
            document.getElementById('actionGoal').value = '';
            document.getElementById('actionOutcomes').value = '';
            document.getElementById('actionContingencies').value = '';
            document.querySelectorAll('.target-checkbox').forEach(btn => btn.classList.remove('selected'));

            updateActionNumber();
            saveData();
        }

        // Undo stack for actions
        let undoStack = [];
        const MAX_UNDO = 50;

        function pushToUndoStack(type, data) {
            const wasAtLimit = undoStack.length >= MAX_UNDO;
            undoStack.push({ type, data, timestamp: Date.now() });
            if (undoStack.length > MAX_UNDO) {
                undoStack.shift();
                // Notify user when limit is reached
                if (!wasAtLimit) {
                    showToast(`Undo limit reached (${MAX_UNDO} actions). Oldest actions will be removed.`, 4000);
                }
            }
        }

        function undoLastAction() {
            if (undoStack.length === 0) {
                showToast('Nothing to undo');
                return;
            }
            const lastAction = undoStack.pop();
            // Restore previous state
            if (lastAction.type === 'delete') {
                if (lastAction.data.type === 'action') {
                    actions.push(lastAction.data.item);
                } else if (lastAction.data.type === 'request') {
                    infoRequests.push(lastAction.data.item);
                } else if (lastAction.data.type === 'observation') {
                    observations.push(lastAction.data.item);
                }
            } else if (lastAction.type === 'edit') {
                const item = lastAction.data.item;
                if (lastAction.data.type === 'action') {
                    const index = actions.findIndex(a => a.id === item.id);
                    if (index !== -1) {
                        actions[index] = lastAction.data.original;
                    }
                } else if (lastAction.data.type === 'request') {
                    const index = infoRequests.findIndex(r => r.id === item.id);
                    if (index !== -1) {
                        infoRequests[index] = lastAction.data.original;
                    }
                } else if (lastAction.data.type === 'observation') {
                    const index = observations.findIndex(o => o.id === item.id);
                    if (index !== -1) {
                        observations[index] = lastAction.data.original;
                    }
                }
            }
            updateActionsDisplay();
            updateRequestsDisplay();
            updateObservationsDisplay();
            saveData();
            showToast('Undone');
        }

        function deleteAction(actionId) {
            const action = actions.find(a => a.id === actionId);
            if (!action) return;
            if (!confirm('Delete this action?')) return;
            
            pushToUndoStack('delete', { type: 'action', item: action });
            actions = actions.filter(a => a.id !== actionId);
            // Re-sequence action numbers
            actions.forEach((a, index) => {
                a.number = index + 1;
            });
            updateActionsDisplay();
            saveData();
            showToast('Action deleted');
        }

        // Edit mode state management
        let editMode = {
            active: false,
            actionId: null,
            originalAction: null
        };

        function editAction(actionId) {
            const action = actions.find(a => a.id === actionId);
            if (!action) return;
            
            // If already in edit mode, cancel previous edit
            if (editMode.active && editMode.actionId !== actionId) {
                if (!confirm('Cancel current edit and start new edit?')) return;
                cancelEdit();
            }
            
            // Enter edit mode
            editMode.active = true;
            editMode.actionId = actionId;
            editMode.originalAction = JSON.parse(JSON.stringify(action));
            
            // Populate form with action data
            document.getElementById('actionMechanism').value = action.mechanism || '';
            document.getElementById('actionSector').value = action.sector || '';
            document.getElementById('actionGoal').value = action.goal || '';
            document.getElementById('actionOutcomes').value = action.outcomes || '';
            document.getElementById('actionContingencies').value = action.contingencies || '';
            document.getElementById('actionExposure').value = action.exposure || '';
            
            // Select targets
            document.querySelectorAll('.target-checkbox').forEach(btn => {
                btn.classList.toggle('selected', action.targets?.includes(btn.getAttribute('data-target')));
            });
            
            // Update UI to show edit mode
            const submitButton = document.querySelector('button[onclick*="addAction"]');
            if (submitButton) {
                submitButton.textContent = 'Update Action';
                submitButton.onclick = saveEditedAction;
            }
            
            // Scroll to form
            const formElement = document.getElementById('actionMechanism');
            if (formElement) {
                formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            showToast('Edit mode: Make changes and click "Update Action" to save');
        }

        function cancelEdit() {
            if (!editMode.active) return;
            
            // Restore form
            document.getElementById('actionMechanism').value = '';
            document.getElementById('actionSector').value = '';
            document.getElementById('actionGoal').value = '';
            document.getElementById('actionOutcomes').value = '';
            document.getElementById('actionContingencies').value = '';
            document.getElementById('actionExposure').value = '';
            document.querySelectorAll('.target-checkbox').forEach(btn => btn.classList.remove('selected'));
            
            // Restore button
            const submitButton = document.querySelector('button[onclick*="addAction"], button[onclick*="saveEditedAction"]');
            if (submitButton) {
                submitButton.textContent = 'Add Action';
                submitButton.onclick = addAction;
            }
            
            editMode.active = false;
            editMode.actionId = null;
            editMode.originalAction = null;
        }

        function saveEditedAction() {
            if (!editMode.active || !editMode.actionId) {
                showToast('Not in edit mode');
                return;
            }
            
            const mechanism = document.getElementById('actionMechanism').value;
            const sector = document.getElementById('actionSector').value;
            const goal = document.getElementById('actionGoal').value.trim();
            const outcomes = document.getElementById('actionOutcomes').value.trim();
            const contingencies = document.getElementById('actionContingencies').value.trim();
            const exposure = document.getElementById('actionExposure').value;

            if (!mechanism || !sector || !goal || !outcomes || !contingencies || !exposure) {
                alert('Please fill in all required fields.');
                return;
            }

            const selectedTargets = Array.from(document.querySelectorAll('.target-checkbox.selected'))
                .map(btn => btn.getAttribute('data-target'));

            if (selectedTargets.length === 0) {
                alert('Please select at least one target.');
                return;
            }

            // Find and update the action
            const actionIndex = actions.findIndex(a => a.id === editMode.actionId);
            if (actionIndex === -1) {
                showToast('Action not found');
                cancelEdit();
                return;
            }

            const updatedAction = {
                ...actions[actionIndex],
                mechanism: mechanism,
                sector: sector,
                targets: selectedTargets,
                exposure: exposure,
                goal: goal,
                outcomes: outcomes,
                contingencies: contingencies,
                phase: currentPhase,
                timestamp: new Date().toLocaleString()
            };

            pushToUndoStack('edit', { type: 'action', item: updatedAction, original: editMode.originalAction });
            actions[actionIndex] = updatedAction;
            
            updateActionsDisplay();
            saveData();
            showToast('Action updated');
            
            // Exit edit mode
            cancelEdit();
        }

        function deleteRequest(requestId) {
            const request = infoRequests.find(r => r.id === requestId);
            if (!request) return;
            if (!confirm('Delete this request?')) return;
            
            pushToUndoStack('delete', { type: 'request', item: request });
            infoRequests = infoRequests.filter(r => r.id !== requestId);
            
            // Update localStorage to notify White Cell
            const sessionId = getSessionId();
            const keySession = `blueRequests_session_${sessionId}_move_${currentMove}`;
            try {
                const existing = safeGetItem(keySession, []);
                const updated = existing.filter(r => r.id !== requestId);
                safeSetItem(keySession, updated);
                
                // Also update legacy key if it exists
                const keySimple = `blueRequests_move_${currentMove}`;
                if (localStorage.getItem(keySimple)) {
                    safeSetItem(keySimple, updated);
                }
                
                // Notify White Cell via storage event marker
                localStorage.setItem('_requestDeleted', JSON.stringify({
                    requestId: requestId,
                    move: currentMove,
                    sessionId: sessionId,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.error('Error updating request storage:', e);
            }
            
            updateRequestsDisplay();
            saveData();
            showToast('Request deleted');
        }

        function deleteObservation(obsId) {
            const obs = observations.find(o => o.id === obsId);
            if (!obs) return;
            if (!confirm('Delete this observation?')) return;
            
            pushToUndoStack('delete', { type: 'observation', item: obs });
            observations = observations.filter(o => o.id !== obsId);
            updateObservationsDisplay();
            saveData();
            showToast('Observation deleted');
        }

        function updateActionsDisplay() {
            const container = document.getElementById('currentActions');
            
            // Apply search and filter
            let filteredActions = actions;
            if (searchQuery) {
                filteredActions = searchItems(actions, searchQuery, ['goal', 'outcomes', 'contingencies', 'mechanism', 'sector']);
            }
            if (currentFilter !== 'all') {
                filteredActions = filteredActions.filter(a => a.phase === parseInt(currentFilter));
            }
            
            if (filteredActions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        <p>${searchQuery || currentFilter !== 'all' ? 'No actions match your search/filter' : 'No actions recorded yet'}</p>
                        <p>${searchQuery || currentFilter !== 'all' ? 'Try a different search term or filter' : 'Actions will appear here when decided'}</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = filteredActions.map(action => {
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
                <div class="action-item" data-action-id="${action.id}">
                    <div class="action-header">
                        <span class="action-number">Action ${action.number}</span>
                        <span>${action.timestamp}</span>
                        <div style="display: flex; gap: 8px; margin-left: auto;">
                            <button onclick="editAction(${action.id})" style="padding: 4px 8px; font-size: 0.75rem; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                            <button onclick="deleteAction(${action.id})" style="padding: 4px 8px; font-size: 0.75rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                        </div>
                    </div>
                    <div><strong>Mechanism:</strong> ${mechanismNames[action.mechanism] || action.mechanism}</div>
                    <div><strong>Sector:</strong> ${sectorNames[action.sector] || action.sector}</div>
                    <div><strong>Targets:</strong> ${action.targets.join(', ').toUpperCase()}</div>
                    <div><strong>Type of Exposure:</strong> ${(
                        {
                            'critical-minerals': 'Critical Minerals',
                            'supply-chain': 'Supply Chain',
                            'technologies': 'Technologies',
                            'manufacturing': 'Manufacturing'
                        }[action.exposure]
                    ) || action.exposure}</div>
                    <div><strong>Goal:</strong> ${action.goal}</div>
                    <div><strong>Expected Outcomes:</strong> ${action.outcomes}</div>
                    <div><strong>Ally Contingencies:</strong> ${action.contingencies}</div>
                </div>
            `}).join('');
            
            document.getElementById('actionsBadge').textContent = actions.length;
        }
        
        // Make functions globally available
        window.addAction = addAction;
        window.addObservation = addObservation;
        window.deleteAction = deleteAction;
        window.editAction = editAction;
        window.deleteRequest = deleteRequest;
        window.deleteObservation = deleteObservation;
        window.undoLastAction = undoLastAction;

        function updateActionNumber() {
            document.getElementById('actionNumber').value = `Action ${actions.length + 1}`;
        }

        // Observations management
        function addObservation() {
            const category = document.getElementById('observationCategory').value;
            const text = document.getElementById('newObservationText').value.trim();

            if (!category || !text) {
                alert('Please select a category and provide observation details.');
                return;
            }

            const observation = {
                id: Date.now(),
                category: category,
                text: text,
                phase: currentPhase,
                timestamp: new Date().toLocaleString()
            };

            observations.push(observation);
            updateObservationsDisplay();
            updateTimeline(); // Update timeline when observation is added
            document.getElementById('observationCategory').value = '';
            document.getElementById('newObservationText').value = '';
            saveData();
        }

        function updateObservationsDisplay() {
            const container = document.getElementById('keyObservations');
            if (observations.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        <p>No observations recorded yet</p>
                        <p>Key insights will appear here when added</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = observations.map(obs => {
                const categoryNames = {
                    'strategic': 'Strategic Insights',
                    'team': 'Team Dynamics',
                    'technical': 'Technical Issues',
                    'decision': 'Decision Points',
                    'risk': 'Risk Assessment',
                    'communication': 'Communication Patterns',
                    'resource': 'Resource Allocation',
                    'timeline': 'Timeline Issues'
                };
                return `
                <div class="action-item" data-observation-id="${obs.id}">
                    <div class="action-header">
                        <span class="action-number">Observation ${observations.indexOf(obs) + 1}</span>
                        <span class="category-tag">${categoryNames[obs.category] || obs.category}</span>
                        <span>${obs.timestamp}</span>
                        <div style="display: flex; gap: 8px; margin-left: auto;">
                            <button onclick="deleteObservation(${obs.id})" style="padding: 4px 8px; font-size: 0.75rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                        </div>
                    </div>
                    <div>${obs.text}</div>
                </div>
            `}).join('');
            
            document.getElementById('observationsBadge').textContent = observations.length;
        }

        // Use a single global toast implementation defined later; remove local duplicate

        async function saveData() {
            try {
                const data = {
                    move: currentMove,
                    phase: currentPhase,
                    actions: actions,
                    infoRequests: infoRequests,
                    observations: observations
                };
                
                // Save to localStorage using safeSetItem
                const sessionId = getSessionId();
                const key = `actions_session_${sessionId}_move_${currentMove}`;
                if (!safeSetItem(key, data)) {
                    throw new Error('Failed to save data to storage');
                }
                
                // Auto-save to data_storage folder (throttled - only every 30 seconds)
                if (typeof autoSaveFacilitatorData === 'function') {
                    const lastSave = localStorage.getItem(`lastAutoSave_facilitator_${sessionId}_${currentMove}`);
                    const now = Date.now();
                    if (!lastSave || (now - parseInt(lastSave)) > 30000) {
                        autoSaveFacilitatorData(sessionId, currentMove);
                        localStorage.setItem(`lastAutoSave_facilitator_${sessionId}_${currentMove}`, now.toString());
                    }
                }
            } catch (e) {
                console.error('Failed to save data', e);
                if (e.name === 'QuotaExceededError') {
                    alert('Browser storage is full. Please clear some data or use a different browser.');
                } else {
                    console.error('Unexpected error saving data:', e);
                }
            }
        }

        // Search and filter functionality
        let searchQuery = '';
        let currentFilter = 'all';

        function performSearch() {
            const query = document.getElementById('searchInput')?.value || '';
            searchQuery = query.toLowerCase();
            updateActionsDisplay();
            updateRequestsDisplay();
            updateObservationsDisplay();
        }

        function filterByType(type) {
            currentFilter = type;
            updateActionsDisplay();
            updateRequestsDisplay();
            updateObservationsDisplay();
        }

        async function exportData() {
            try {
                await saveData();
                
                const sessionId = getSessionId();
                // Export all moves, not just current
                const allMoves = {};
                const allRequests = {};
                const allTimelineItems = [];
                
                for (let i = 1; i <= 3; i++) {
                    const data = safeGetItem(`actions_session_${sessionId}_move_${i}`, null);
                    if (data) {
                        allMoves[i] = data;
                    }
                    
                    // Include requests for each move
                    const requests = safeGetItem(`blueRequests_session_${sessionId}_move_${i}`, []);
                    if (requests && requests.length > 0) {
                        allRequests[i] = requests;
                    }
                    
                    // Include timeline items from shared storage
                    const timelineKey = `whiteCell_session_${sessionId}_move_${i}`;
                    const timelineData = safeGetItem(timelineKey, {});
                    if (timelineData.timelineItems && Array.isArray(timelineData.timelineItems)) {
                        const blueItems = timelineData.timelineItems.filter(item => 
                            item.team === 'blue' || item.team === 'BLUE'
                        );
                        allTimelineItems.push(...blueItems.map(item => ({ ...item, move: i })));
                    }
                }
                
                if (Object.keys(allMoves).length === 0 && Object.keys(allRequests).length === 0) {
                    alert('No data to export. Please add some data first.');
                    return;
                }
                
                const exportData = {
                    exported: new Date().toISOString(),
                    exportedBy: 'BLUE Team Facilitator',
                    sessionId: sessionId,
                    allMoves: allMoves,
                    allRequests: allRequests,
                    timelineItems: allTimelineItems,
                    currentMove: currentMove,
                    currentPhase: currentPhase,
                    metadata: {
                        exportVersion: '1.0',
                        includesRequests: true,
                        includesTimeline: true
                    }
                };
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
                a.download = `BLUE_Facilitator_Session_${sessionId}_${timestamp}.json`;
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
        window.exportData = exportData;

        // Backup and recovery
        function createBackupNow() {
            const sessionId = getSessionId();
            const backup = createBackup(sessionId);
            const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${sessionId}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            showToast('Backup created');
        }

        function restoreFromBackup() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const backup = JSON.parse(event.target.result);
                        if (restoreBackup(backup)) {
                            loadData();
                            showToast('Backup restored');
                        } else {
                            alert('Failed to restore backup');
                        }
                    } catch (e) {
                        alert('Invalid backup file');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        window.createBackupNow = createBackupNow;
        window.restoreFromBackup = restoreFromBackup;
        window.performSearch = performSearch;
        window.filterByType = filterByType;

        async function sendToWhiteCell() {
            let loadingStop = null;
            try {
                // Show loading state
                const submitButton = document.querySelector('button[onclick*="sendToWhiteCell"]');
                if (submitButton && typeof setButtonLoading === 'function') {
                    loadingStop = setButtonLoading(submitButton, 'Submitting...');
                }
                
                await saveData();
                
                const sessionId = getSessionId();
                const data = safeGetItem(`actions_session_${sessionId}_move_${currentMove}`, null);
                
                if (!data || !data.actions || data.actions.length === 0) {
                    alert('No actions to submit. Please add at least one action before submitting.');
                    if (loadingStop && typeof loadingStop === 'function') loadingStop();
                    return;
                }
                
                // Comprehensive validation before submission
                const actionCount = data.actions.length;
                const requestCount = (data.infoRequests || []).length;
                const observationCount = (data.observations || []).length;
                
                // Validate each action has required fields
                const invalidActions = [];
                data.actions.forEach((action, index) => {
                    const requiredFields = ['mechanism', 'sector', 'goal', 'outcomes', 'contingencies', 'exposure'];
                    const missingFields = requiredFields.filter(field => !action[field] || action[field].trim() === '');
                    if (missingFields.length > 0) {
                        invalidActions.push({
                            index: index + 1,
                            missingFields: missingFields
                        });
                    }
                    // Validate targets exist
                    if (!action.targets || !Array.isArray(action.targets) || action.targets.length === 0) {
                        if (!invalidActions.find(a => a.index === index + 1)) {
                            invalidActions.push({
                                index: index + 1,
                                missingFields: ['targets']
                            });
                        } else {
                            invalidActions.find(a => a.index === index + 1).missingFields.push('targets');
                        }
                    }
                });
                
                if (invalidActions.length > 0) {
                    const errorMsg = 'Validation failed. The following actions have missing required fields:\n\n' +
                        invalidActions.map(a => `Action ${a.index}: Missing ${a.missingFields.join(', ')}`).join('\n') +
                        '\n\nPlease complete all required fields before submitting.';
                    alert(errorMsg);
                    if (loadingStop && typeof loadingStop === 'function') loadingStop();
                    return;
                }
                
                // Validate phase appropriateness (actions should typically be in phase 3)
                if (currentPhase < 3) {
                    if (!confirm('You are submitting actions in Phase ' + currentPhase + '. Actions are typically submitted in Phase 3 (Finalization). Continue anyway?')) {
                        if (loadingStop && typeof loadingStop === 'function') loadingStop();
                        return;
                    }
                }
                
                // Validate data integrity - check for corrupted or invalid JSON structures
                try {
                    const testString = JSON.stringify(data);
                    const testParse = JSON.parse(testString);
                    if (!testParse.actions || !Array.isArray(testParse.actions)) {
                        throw new Error('Invalid data structure: actions must be an array');
                    }
                } catch (e) {
                    alert('Data integrity check failed: ' + e.message + '\n\nPlease try saving and reloading the page.');
                    if (loadingStop && typeof loadingStop === 'function') loadingStop();
                    return;
                }
                
                // Persist a session-aware submission flag for WHITE reads
                const submissionData = {
                    submittedAt: new Date().toISOString(),
                    submittedBy: 'facilitator',
                    count: actionCount,
                    requestCount: requestCount,
                    observationCount: observationCount,
                    dataRef: `actions_session_${sessionId}_move_${currentMove}`,
                    move: currentMove,
                    phase: currentPhase
                };
                
                if (!safeSetItem(`blueActions_session_${sessionId}_move_${currentMove}`, submissionData)) {
                    alert('Failed to save submission. Please check browser storage.');
                    if (loadingStop && typeof loadingStop === 'function') loadingStop();
                    return;
                }
                
                // Append canonical timeline event
                try {
                    appendTimelineItem(sessionId, currentMove, {
                        phase: currentPhase, // Store as number, mapPhaseEnum is for display only
                        type: 'action',
                        title: `Facilitator submitted ${actionCount} actions`,
                        content: `Actions: ${actionCount}, Requests: ${requestCount}, Observations: ${observationCount}`,
                        team: 'blue',
                        refs: { submittedBy: 'facilitator', actionCount, requestCount, observationCount }
                    });
                } catch (e) {
                    console.error('Error appending timeline item:', e);
                }
                
                // Export file for backup
                try {
                    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `BLUE_To_WHITE_Move${currentMove}_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.error('Error creating export file:', e);
                    // Continue even if export fails
                }
                
                // Auto-save to data_storage
                if (typeof autoSaveTeamSubmission === 'function') {
                    await autoSaveTeamSubmission(sessionId, currentMove, 'actions');
                }
                if (typeof autoSaveFacilitatorData === 'function') {
                    await autoSaveFacilitatorData(sessionId, currentMove);
                }
                
                showToast(`Successfully submitted ${actionCount} actions to WHITE Cell`);
                if (loadingStop && typeof loadingStop === 'function') loadingStop();
                
            } catch (error) {
                console.error('Error submitting to WHITE Cell:', error);
                const errorMsg = error.message || error.toString() || 'Unknown error';
                alert(`Error submitting data: ${errorMsg}. Please try again.`);
                showToast('Submission failed - please try again');
                if (loadingStop && typeof loadingStop === 'function') loadingStop();
            }
        }
        
        // Make function globally available
        window.sendToWhiteCell = sendToWhiteCell;

        // Use shared mapPhaseEnum and appendTimelineItem from utils.js

        // Session picker - read-only, controlled by White Cell
        (function initSessionPicker(){
            const input = document.getElementById('sessionInput');
            const apply = document.getElementById('sessionApply');
            const current = getSessionId();
            if (input) {
                input.value = current;
                input.disabled = true;
                input.style.opacity = '0.6';
                input.style.cursor = 'not-allowed';
            }
            if (apply) {
                apply.disabled = true;
                apply.style.opacity = '0.6';
                apply.style.cursor = 'not-allowed';
                apply.addEventListener('click', () => {
                    showToast('Session changes are controlled by White Cell');
                    updateGameStateFromShared();
                });
            }
        })();
        
        // Disable move selector
        function disableMoveSelector() {
            const moveSelector = document.getElementById('moveSelector');
            if (moveSelector) {
                moveSelector.disabled = true;
                moveSelector.style.opacity = '0.6';
                moveSelector.style.cursor = 'not-allowed';
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', disableMoveSelector);
        } else {
            disableMoveSelector();
        }
        
        // Timeline display function
        function updateTimeline() {
            const container = document.getElementById('sessionTimeline');
            if (!container) return;
            
            const allTimelineItems = [];
            
            // Load timeline items from shared storage
            try {
                const sessionId = getSessionId();
                const key = `whiteCell_session_${sessionId}_move_${currentMove}`;
                const data = safeGetItem(key, {});
                if (data.timelineItems && Array.isArray(data.timelineItems)) {
                    // Filter for BLUE team items
                    const blueItems = data.timelineItems.filter(item => 
                        item.team === 'blue' || item.team === 'BLUE'
                    );
                    allTimelineItems.push(...blueItems);
                }
                
                // Also check for notetaker timeline items
                const notesKey = `notes_session_${sessionId}_move_${currentMove}`;
                const notesData = safeGetItem(notesKey, {});
                if (notesData.timelineItems && Array.isArray(notesData.timelineItems)) {
                    allTimelineItems.push(...notesData.timelineItems);
                }
                
                // Add facilitator actions as timeline items
                if (actions && actions.length > 0) {
                    actions.forEach(action => {
                        allTimelineItems.push({
                            type: 'action',
                            time: action.timestamp || new Date().toLocaleTimeString(),
                            timestamp: action.id || Date.now(),
                            phase: action.phase || currentPhase,
                            content: `Action ${action.number}: ${action.goal || 'No goal specified'}`,
                            team: 'blue'
                        });
                    });
                }
                
                // Add observations as timeline items
                if (observations && observations.length > 0) {
                    observations.forEach(obs => {
                        allTimelineItems.push({
                            type: 'observation',
                            time: obs.timestamp || new Date().toLocaleTimeString(),
                            timestamp: obs.id || Date.now(),
                            phase: obs.phase || currentPhase,
                            content: `${obs.category || 'Observation'}: ${obs.text || ''}`,
                            team: 'blue'
                        });
                    });
                }
            } catch (e) {
                console.error('Error loading timeline:', e);
            }
            
            // Deduplicate and sort
            const deduplicated = deduplicateTimelineItems(allTimelineItems);
            const sorted = deduplicated.sort((a, b) => {
                const timeA = a.timestamp || (a.time ? new Date(a.time).getTime() : 0);
                const timeB = b.timestamp || (b.time ? new Date(b.time).getTime() : 0);
                return timeB - timeA;
            });
            
            if (sorted.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>No timeline events</p>
                        <p>Timeline will populate as actions and observations are added</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = sorted.map(item => {
                const typeLabel = item.type === 'action' ? 'Action' :
                                item.type === 'observation' ? 'Observation' :
                                item.type === 'requestinfo' ? 'Info Request' :
                                item.type === 'note' ? 'Note' :
                                item.type === 'moment' ? 'Moment' :
                                item.type === 'quote' ? 'Quote' : 'Event';
                
                return `
                    <div class="timeline-item ${item.type}">
                        <div class="timeline-header">
                            <span class="timeline-time">Phase ${item.phase || currentPhase} | ${item.time || ''}</span>
                            <span class="timeline-type ${item.type}">${typeLabel}</span>
                        </div>
                        <div class="timeline-content">${item.content || ''}</div>
                    </div>
                `;
            }).join('');
        }
        
        // Make updateTimeline available globally
        window.updateTimeline = updateTimeline;
        
        // Poll for game state updates every second
        setInterval(updateGameStateFromShared, 1000);
        
        // Initialize
        updateGameStateFromShared();
        updateTimeline();

        async function loadData() {
            // Load from localStorage with validation
            const sessionId = getSessionId();
            let savedData = safeGetItem(`actions_session_${sessionId}_move_${currentMove}`, null);
            if (!savedData) {
                savedData = safeGetItem(`blueFacilitatorMove${currentMove}`, null);
            }
            
            if (savedData) {
                // Validate data structure with strict validation
                const schema = {
                    actions: { type: 'array', required: false, default: [] },
                    infoRequests: { type: 'array', required: false, default: [] },
                    observations: { type: 'array', required: false, default: [] },
                    move: { type: 'number', required: false },
                    phase: { type: 'number', required: false }
                };
                
                const validated = validateDataStrict(savedData, schema, false);
                if (validated) {
                    actions = Array.isArray(validated.actions) ? validated.actions : [];
                    infoRequests = Array.isArray(validated.infoRequests) ? validated.infoRequests : [];
                    observations = Array.isArray(validated.observations) ? validated.observations : [];
                } else {
                    console.warn('Data validation failed, using empty arrays');
                    showToast('Data validation failed - some data may be missing');
                    actions = [];
                    infoRequests = [];
                    observations = [];
                }
            } else {
                actions = [];
                infoRequests = [];
                observations = [];
            }
            
            updateActionsDisplay();
            updateRequestsDisplay();
            updateObservationsDisplay();
            updateActionNumber();
            loadWhiteResponses();
        }

        async function loadWhiteResponses() {
            // Load from localStorage (session-aware)
            const sessionId = getSessionId();
            const commKey = `communications_session_${sessionId}_move_${currentMove}`;
            const feedbackKey = `whiteCellFeedback_session_${sessionId}_move_${currentMove}`;
            // Try session-aware first, then legacy for migration
            const comm = safeGetItem(commKey, []) || safeGetItem(`communications_move_${currentMove}`, []);
            const feedback = safeGetItem(feedbackKey, []);
            whiteResponses = [
                ...feedback.map(f => ({ summary: f.summary, outcomes: f.outcomes, notes: f.notes, timestamp: f.timestamp })),
                ...comm.map(c => ({ summary: c.title, outcomes: '', notes: c.content, timestamp: c.timestamp }))
            ].sort((a,b)=> (a.timestamp||'').localeCompare(b.timestamp||''));
            updateWhiteResponsesUI();
        }

        function updateWhiteResponsesUI() {
            const badge = document.getElementById('whiteResponsesBadge');
            const container = document.getElementById('whiteResponsesContainer');
            badge.textContent = whiteResponses.length || 0;
            if (!whiteResponses.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p>No responses from WHITE Cell yet</p>
                        <p>Click refresh to check for updates</p>
                    </div>
                `;
                return;
            }
            container.innerHTML = whiteResponses.map((r, i) => `
                <div class="action-item">
                    <div class="action-header">
                        <span class="action-number">Response ${i + 1}</span>
                        <span>${(r.timestamp || r.time || '')}</span>
                    </div>
                    <div><strong>Summary:</strong> ${r.summary || ''}</div>
                    ${r.outcomes ? `<div><strong>Outcomes:</strong> ${r.outcomes}</div>` : ''}
                    ${r.notes ? `<div><strong>Notes:</strong> ${r.notes}</div>` : ''}
                </div>
            `).join('');
        }

        document.getElementById('refreshWhiteResponses').addEventListener('click', loadWhiteResponses);

        // Toast notifications for new responses
        let lastWhiteResponsesCount = 0;
        // Use shared showToast from utils.js

        async function pollWhiteResponses() {
            const prev = lastWhiteResponsesCount;
            await loadWhiteResponses();
            const curr = whiteResponses.length;
            if (curr > prev && prev !== 0) {
                showToast(`New WHITE Cell responses: +${curr - prev}`);
            }
            lastWhiteResponsesCount = curr;
        }

        // Start a light poll every 10s (reduced from 30s for better responsiveness)
        // Also listen for storage events for immediate updates
        setInterval(pollWhiteResponses, 10000);
        
        // Listen for storage events for immediate updates
        window.addEventListener('storage', (e) => {
            if (e.key && (e.key.includes('communications_session_') || e.key.includes('whiteCellFeedback_session_'))) {
                loadWhiteResponses();
            }
        });

        // Timer - Read-only display, controlled by White Cell
        let timerSeconds = 90 * 60;

        function getSharedTimerKey() {
            const sessionId = getSessionId();
            return `sharedTimer_session_${sessionId}`;
        }

        function updateTimer() {
            // Load timer state from shared storage
            const timerState = safeGetItem(getSharedTimerKey(), null);
            if (timerState) {
                // Calculate current time based on when it was last updated
                // Add maximum elapsed time cap to prevent incorrect time if page was closed for extended period
                const MAX_ELAPSED_SECONDS = 24 * 60 * 60; // 24 hours
                let currentSeconds = timerState.seconds || 90 * 60;
                if (timerState.running && timerState.lastUpdate) {
                    const elapsed = Math.floor((Date.now() - timerState.lastUpdate) / 1000);
                    const cappedElapsed = Math.min(elapsed, MAX_ELAPSED_SECONDS);
                    currentSeconds = Math.max(0, currentSeconds - cappedElapsed);
                    
                    // If elapsed time exceeds cap, reset timer
                    if (elapsed > MAX_ELAPSED_SECONDS) {
                        currentSeconds = 90 * 60;
                    }
                }
                timerSeconds = currentSeconds;
            }

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
        }

        // Hide timer controls (read-only display)
        function hideTimerControls() {
            const timerControls = document.querySelector('.timer-controls');
            if (timerControls) {
                timerControls.style.display = 'none';
            }
        }
        
        // Hide controls immediately if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hideTimerControls);
        } else {
            hideTimerControls();
        }

        // Poll timer state every second for real-time updates
        setInterval(updateTimer, 1000);

        // Initialize
        updateTimer();
        updateGameStateFromShared(); // Load move, phase, session from White Cell
        updatePhaseGuidance();
        loadData();
        
        // Standardized loader hide
        window.addEventListener('load', function() {
            setTimeout(function() {
                const loader = document.getElementById('loader');
                if (loader && !loader.classList.contains('hidden')) {
                    loader.classList.add('hidden');
                }
            }, 1500);
        });