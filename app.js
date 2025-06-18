import DB from './db.js';


console.log("APP.JS RUN")
const App = {
    pyodide: null,
    isReady: false, // NEW: Loading flag
    state: {
        userName: null,
        xp: 0,
        level: 1,
        currentChapterId: 'intro',
        completedChapters: [],
        unlockedAchievements: []
    },
    editors: {},

    // --- Initialization ---
    async init() {
        this.loadState();
        this.addEventListeners(); 
        
        try {
            await this.initPyodide();
            this.isReady = true; // Pyodide is now ready!
            document.getElementById('loader').style.opacity = '0';
            setTimeout(() => document.getElementById('loader').style.display = 'none', 500);
        } catch (error) {
            console.error("Pyodide failed to load:", error);
            const loaderText = document.querySelector('#loader p');
            loaderText.textContent = "عذرًا، حدث خطأ أثناء تحميل المعمل الرقمي. يرجى تحديث الصفحة.";
            loaderText.style.color = 'var(--accent-primary)';
            return; // Stop initialization
        }
        
        this.renderSidebar();
        this.renderChapter(this.state.currentChapterId);
        this.updatePlayerStats();
        
        if (!this.state.unlockedAchievements.includes('start_journey')) {
            this.unlockAchievement('start_journey');
        }
        if(!this.state.userName) {
            const name = prompt("مرحبًا بك يا صانع العوالم المستقبلي! ما هو اسمك؟", "البطل");
            this.state.userName = name || "البطل";
            this.saveState();
        }
    },

    async initPyodide() {
        const loaderText = document.querySelector('#loader p');
        loaderText.textContent = 'يتم تحميل محرك بايثون...';
        this.pyodide = await loadPyodide();
        this.pyodide.setStdout({ batched: (msg) => this.handleOutput(msg, 'stdout') });
        this.pyodide.setStderr({ batched: (msg) => this.handleOutput(msg, 'stderr') });
    },
    
    // --- State Management ---
    saveState() {
        localStorage.setItem('pythonJourneyState', JSON.stringify(this.state));
    },
    loadState() {
        const savedState = localStorage.getItem('pythonJourneyState');
        if (savedState) {
            this.state = { ...this.state, ...JSON.parse(savedState) };
        }
    },
    resetState() {
        if (confirm('هل أنت متأكد أنك تريد إعادة تعيين كل تقدمك؟ لا يمكن التراجع عن هذا الإجراء.')) {
            localStorage.removeItem('pythonJourneyState');
            location.reload();
        }
    },
    
    // --- Rendering ---
    renderSidebar() {
        const navList = document.getElementById('nav-list');
        navList.innerHTML = '';
        DB.chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.classList.add('nav-item');
            
            const isCompleted = this.state.completedChapters.includes(chapter.id);
            const isActive = this.state.currentChapterId === chapter.id;
            const isLocked = index >= 2 && !this.state.completedChapters.includes(DB.chapters[index - 1].id);

            if (isActive) li.classList.add('active');
            if (isCompleted) li.classList.add('completed');
            if (isLocked) li.classList.add('locked');
            
            let iconClass = isLocked ? '🔒' : (isCompleted ? '✅' : chapter.icon || '📘');

            li.innerHTML = `<a href="#" data-chapter-id="${chapter.id}"><span class="icon">${iconClass}</span>${chapter.title}</a>`;
            navList.appendChild(li);
        });
    },

    renderChapter(chapterId) {
        const chapter = DB.chapters.find(c => c.id === chapterId);
        if (!chapter) return;
        
        const chapterIndex = DB.chapters.findIndex(c => c.id === chapterId);
        // CORRECTED BUG: Used 'index' instead of 'chapterIndex'
        const isLocked = chapterIndex >= 2 && !this.state.completedChapters.includes(DB.chapters[chapterIndex - 1].id);
        if (isLocked) {
            this.showToast('error', 'الفصل مقفل!', 'أكمل الفصل السابق لفتح هذا الفصل.');
            return;
        }

        this.state.currentChapterId = chapterId;
        const contentArea = document.getElementById('content-area');
        
        contentArea.innerHTML = marked.parse(chapter.markdownContent);
        
        this.renderSidebar();
        this.enhanceContentBlocks(); // ADDED THIS LINE
        this.setupAllEditors();
        this.saveState();
        window.scrollTo(0, 0);

        if(chapterId === 'conclusion' && this.state.completedChapters.includes('chapter6')) {
            this.renderCertificate();
        }
    },

    enhanceContentBlocks() {
        // Find all <pre><code> blocks that are direct children of the content area.
        // The markdown library creates this structure.
        document.querySelectorAll('#content-area > pre').forEach(preElement => {
            const codeElement = preElement.querySelector('code.language-python');
            
            // If the block is not a python block, or has already been enhanced, skip it.
            if (!codeElement || preElement.classList.contains('enhanced')) {
                return;
            }

            // Mark as enhanced to prevent re-processing
            preElement.classList.add('enhanced');
            
            // Activate syntax highlighting
            hljs.highlightElement(codeElement);

            // Now, build the wrapper component
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';

            const header = document.createElement('div');
            header.className = 'code-block-header';
            header.innerHTML = `
                <span>Python</span>
                <div class="code-block-buttons">
                    <button class="copy-btn">نسخ</button>
                    <button class="run-btn">شغّل الكود</button>
                </div>
            `;

            const output = document.createElement('pre');
            output.className = 'code-output';
            
            // Move the <pre> tag into the wrapper, then build the rest
            preElement.parentNode.insertBefore(wrapper, preElement);
            wrapper.appendChild(header);
            wrapper.appendChild(preElement);
            wrapper.appendChild(output);
        });
    },
    
    
    // --- Content Enhancement and Interactions ---
    setupAllEditors() {
        document.querySelectorAll('.mission-editor').forEach(editorEl => {
            this.setupMissionEditor(editorEl);
        });
    },
    
    setupMissionEditor(editorEl) {
        const chapterId = editorEl.id.replace('mission-editor-', '');
        const chapter = DB.chapters.find(c => c.id === chapterId);
        const initialCode = (chapter && chapter.mission && chapter.mission.placeholder) || `# اكتب كود المهمة هنا`;

        // Clear the container first
        editorEl.innerHTML = '';

        // Initialize CodeMirror
        const editorInstance = CodeMirror(editorEl, {
            value: initialCode,
            mode: 'python',
            theme: 'material-darker', // A great dark theme
            lineNumbers: true,
            matchBrackets: true,
            indentUnit: 4
        });

        // Store the instance so we can get its value later
        this.editors[editorEl.id] = editorInstance;
        
        // A slight delay to ensure the editor has rendered before refreshing it
        // This fixes a rare bug where the editor might not appear initially
        setTimeout(() => {
            editorInstance.refresh();
        }, 1);
    },
    
    downloadCode(chapterId) {
        const editorId = `mission-editor-${chapterId}`;
        const editorInstance = this.editors[editorId];

        // Correct way to get the code from CodeMirror
        const code = editorInstance ? editorInstance.getValue() : '';

        if (!code.trim()) {
            this.showToast('error', 'لا يوجد كود!', 'اكتب الكود في المحرر أولاً.');
            return;
        }
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chapterId}_solution.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },


    renderCertificate() {
        console.log("renderCertificate: I am being called!"); // LOG
        const certSection = document.getElementById('certificate-section');
        if (!certSection) return;

        certSection.innerHTML = `
        <div class="certificate-container" style="background: var(--bg-primary); border: none; padding: 1rem;">
            <canvas id="certificateCanvas" style="width: 100%; max-width: 800px; border-radius: var(--border-radius);"></canvas>
            <div class="mission-controls" style="justify-content: center; margin-top: 1rem;">
                <button class="mission-btn download-cert-btn" id="download-cert-btn">تحميل الشهادة</button>
            </div>
        </div>
        `;
        // Immediately draw the initial preview
        this.drawCertificatePreview();
    },

    drawCertificatePreview() {
        const canvas = document.getElementById('certificateCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const name = this.state.userName || "البطل";

        const certWidth = 1200; // Natural width of our design
        const certHeight = 848; // Natural height

        // High-DPI rendering for the preview canvas
        const dpr = window.devicePixelRatio || 1;
        canvas.width = certWidth * dpr;
        canvas.height = certHeight * dpr;
        canvas.style.width = `${certWidth}px`; // Set display size
        canvas.style.height = `${certHeight}px`;
        ctx.scale(dpr, dpr);

        // Since we don't have a background image, we draw the elements directly.
        // This is our 'drawCard' equivalent.
        this.drawCertificateElements(ctx, name, certWidth, certHeight);
    },

    // ADD THIS NEW HELPER FUNCTION
    drawCertificateElements(ctx, name, certWidth, certHeight) {
        // Define colors
        const gold = '#c7b283';
        const darkBlue = '#16213e';
        const accentRed = '#e94560';

        // --- Draw Background ---
        ctx.fillStyle = '#fdfdfd';
        ctx.fillRect(0, 0, certWidth, certHeight);

        // --- Draw Borders ---
        ctx.strokeStyle = gold;
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, certWidth - 20, certHeight - 20);
        
        ctx.strokeStyle = '#a89467';
        ctx.lineWidth = 4;
        ctx.strokeRect(30, 30, certWidth - 60, certHeight - 60);

        // --- Draw Text ---
        ctx.fillStyle = darkBlue;
        ctx.font = '900 70px "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('شهادة إتمام', certWidth / 2, 180);

        ctx.fillStyle = '#555';
        ctx.font = '400 30px "Cairo", sans-serif';
        ctx.fillText('تُقدم بفخر إلى', certWidth / 2, 260);

        ctx.fillStyle = accentRed;
        ctx.font = 'bold 90px "Cairo", sans-serif';
        ctx.fillText(name, certWidth / 2, 380);

        ctx.fillStyle = '#333';
        ctx.font = '400 28px "Cairo", sans-serif';
        ctx.fillText('لإتمامه بنجاح رحلة "بناء العوالم الرقمية"', certWidth / 2, 480);
        ctx.fillText('وإتقانه للمفاهيم الأساسية في لغة البرمجة بايثون', certWidth / 2, 530);
        
        ctx.fillStyle = darkBlue;
        ctx.font = '40px "Great Vibes", cursive';
        ctx.fillText('نقابة بُناة العوالم', certWidth / 2, 670);
        
        ctx.beginPath();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.moveTo(certWidth / 2 - 200, 680);
        ctx.lineTo(certWidth / 2 + 200, 680);
        ctx.stroke();

        ctx.fillStyle = '#777';
        ctx.font = '20px "Cairo", sans-serif';
        ctx.fillText('المملكة الرقمية', certWidth / 2, 710);
    },

    async drawCertificate(forDownload = false) {
        // Find the canvas. If it's for download, create a new one in memory.
        const canvas = forDownload 
            ? document.createElement('canvas') 
            : document.getElementById('certificateCanvas');
        
        if (!canvas) return null; // Exit if canvas not found
        
        const ctx = canvas.getContext('2d');
        const name = this.state.userName || "البطل";

        // --- Define Certificate Dimensions and Assets ---
        // These are the natural dimensions of our "certificate paper"
        const certWidth = 1200;
        const certHeight = 848;

        // Define colors
        const gold = '#c7b283';
        const darkBlue = '#16213e';
        const accentRed = '#e94560';

        // --- Set Canvas Size ---
        // For download, use natural size. For display, use DPR for sharpness.
        const dpr = forDownload ? 1 : (window.devicePixelRatio || 1);
        canvas.width = certWidth * dpr;
        canvas.height = certHeight * dpr;
        ctx.scale(dpr, dpr);

        // --- Draw Background ---
        ctx.fillStyle = '#fdfdfd';
        ctx.fillRect(0, 0, certWidth, certHeight);

        // --- Draw Borders ---
        ctx.strokeStyle = gold;
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, certWidth - 20, certHeight - 20);
        
        ctx.strokeStyle = '#a89467';
        ctx.lineWidth = 4;
        ctx.strokeRect(30, 30, certWidth - 60, certHeight - 60);

        // --- Draw Text ---
        // Main Title
        ctx.fillStyle = darkBlue;
        ctx.font = '900 70px "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('شهادة إتمام', certWidth / 2, 180);

        // Subtitle
        ctx.fillStyle = '#555';
        ctx.font = '400 30px "Cairo", sans-serif';
        ctx.fillText('تُقدم بفخر إلى', certWidth / 2, 260);

        // Recipient's Name
        ctx.fillStyle = accentRed;
        ctx.font = 'bold 90px "Cairo", sans-serif';
        ctx.fillText(name, certWidth / 2, 380);

        // Body Text
        ctx.fillStyle = '#333';
        ctx.font = '400 28px "Cairo", sans-serif';
        ctx.fillText('لإتمامه بنجاح رحلة "بناء العوالم الرقمية"', certWidth / 2, 480);
        ctx.fillText('وإتقانه للمفاهيم الأساسية في لغة البرمجة بايثون', certWidth / 2, 530);

        // --- Draw Signature ---
        // Signature Line
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(certWidth / 2 - 200, 680);
        ctx.lineTo(certWidth / 2 + 200, 680);
        ctx.stroke();
        
        // Signature Text
        ctx.fillStyle = darkBlue;
        ctx.font = '40px "Great Vibes", cursive'; // The special signature font
        ctx.fillText('نقابة بُناة العوالم', certWidth / 2, 670);

        // Signature Subtext
        ctx.fillStyle = '#777';
        ctx.font = '20px "Cairo", sans-serif';
        ctx.fillText('المملكة الرقمية', certWidth / 2, 710);
        
        // If we are drawing for download, return the canvas
        if (forDownload) {
            return canvas;
        }
    },


    // --- Gamification ---
    addXp(amount) {
        this.showToast('xp', `+${amount} نقطة خبرة!`, 'عمل رائع، استمر في التقدم!');
        
        let xpForNextLevel = this.state.level * 100;
        let currentXp = this.state.xp + amount;

        // Check if XP is enough to level up
        if (currentXp >= xpForNextLevel) {
            // First, show the bar filling up completely
            this.state.xp = xpForNextLevel;
            this.updatePlayerStats();

            // Announce the level up
            const newLevel = this.state.level + 1;
            this.showToast('achievement', '🎉 ترقية المستوى!', `لقد وصلت إلى المستوى ${newLevel}!`);

            // Use a short delay so the user can see the full bar before it resets
            setTimeout(() => {
                this.state.level = newLevel;
                this.state.xp = currentXp - xpForNextLevel; // Set the leftover XP
                this.updatePlayerStats();
                this.saveState(); // Save state after the animation/delay
            }, 1000); // 1-second delay

        } else {
            // If not leveling up, just add the XP normally
            this.state.xp = currentXp;
            this.updatePlayerStats();
            this.saveState();
        }
    },
    
    updatePlayerStats() {
        document.getElementById('player-level').textContent = this.state.level;
        const xpForNextLevel = this.state.level * 100;
        document.getElementById('player-xp').textContent = `${this.state.xp}/${xpForNextLevel}`;
        const xpPercentage = (this.state.xp / xpForNextLevel) * 100;
        document.getElementById('xp-bar-fill').style.width = `${xpPercentage}%`;
    },
    unlockAchievement(id) {
        if (!DB.achievements[id] || this.state.unlockedAchievements.includes(id)) {
            return;
        }
        this.state.unlockedAchievements.push(id);
        const achievement = DB.achievements[id];
        this.showToast('achievement', `🏅 إنجاز جديد: ${achievement.title}`, achievement.description);
        this.saveState();
    },
    
    async completeMission(chapterId) {
        if(this.state.completedChapters.includes(chapterId)) {
            this.showToast('info', 'مهمة مكتملة', 'لقد أكملت هذه المهمة بالفعل.');
            return;
        }

        const chapter = DB.chapters.find(c => c.id === chapterId);
        const editorId = `mission-editor-${chapterId}`;
        const outputId = `mission-output-${chapterId}`;
        const editor = this.editors[editorId];
        const outputEl = document.getElementById(outputId);
        
        if (!editor || !chapter || !chapter.mission) return;

        const code = editor.getValue();
        const result = await this.runCode(code, outputEl);
        
        if (result.error) {
            this.showToast('error', 'خطأ في الكود!', 'راجع رسالة الخطأ في الصندوق وحاول مرة أخرى.');
            return;
        }
        
        const validation = chapter.mission.validate(code, result.output);
        
        outputEl.textContent = validation.message + '\n\n--- مخرجات الكود ---\n' + (result.output || '(لا توجد مخرجات)');
        outputEl.classList.toggle('error', !validation.pass);
        outputEl.classList.toggle('success', validation.pass);

        if (validation.pass) {
            this.state.completedChapters.push(chapterId);
            
            let xpGained = 100;
            const achievementMap = {
                'chapter1': 'first_code', 'chapter2': 'variable_tamer', 'chapter3': 'logic_master',
                'chapter4': 'loop_sorcerer', 'chapter5': 'function_architect', 'chapter6': 'future_seer'
            };
            if(achievementMap[chapterId]) this.unlockAchievement(achievementMap[chapterId]);
            
            const currentIdx = DB.chapters.findIndex(c => c.id === chapterId);
            if (currentIdx === DB.chapters.length - 1) { // This is the last chapter (conclusion)
                    this.unlockAchievement('world_builder');
                    xpGained = 200;
            }

            this.addXp(xpGained);
            this.saveState();

            this.showToast('achievement', `🎉 ${chapter.title} مكتمل!`, 'لقد فتحت الفصل التالي.');
            
            if (currentIdx < DB.chapters.length - 1) {
                const nextChapterId = DB.chapters[currentIdx + 1].id;
                this.renderChapter(nextChapterId);
            } else {
                this.renderSidebar(); 
            }
        }
    },

    // --- Code Execution ---
    _outputBuffer: { 'stdout': [], 'stderr': [] },
    handleOutput(msg, type) {
        this._outputBuffer[type].push(msg);
    },
    async runCode(code, outputEl) {
        if (!this.isReady) { // Check the ready flag
            this.showToast('error', 'المعمل ليس جاهزًا بعد', 'يرجى الانتظار بضع لحظات حتى يكتمل التحميل.');
            return { error: "Pyodide not ready.", output: '' };
        }

        this._outputBuffer.stdout = [];
        this._outputBuffer.stderr = [];
        
        try {
            this.pyodide.globals.set("input", (prompt_msg = "") => { return prompt(prompt_msg); });
            await this.pyodide.runPythonAsync(code);
            
            if (this._outputBuffer.stderr.length > 0) {
                    if(outputEl) outputEl.textContent = this._outputBuffer.stderr.join('\n');
                    if(outputEl) outputEl.classList.add('error');
                    return { error: this._outputBuffer.stderr.join('\n'), output: '' };
            }
            const stdout = this._outputBuffer.stdout.join('\n');
            if(outputEl) outputEl.textContent = stdout || '(لا توجد مخرجات)';
            if(outputEl) outputEl.classList.remove('error');
            return { error: null, output: stdout };
        } catch (err) {
            const errorMsg = err.toString();
            if(outputEl) outputEl.textContent = errorMsg;
            if(outputEl) outputEl.classList.add('error');
            return { error: errorMsg, output: '' };
        }
    },
    
    // --- UI Helpers ---
    showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconSvg = '';
        if (type === 'achievement') iconSvg = '🏅';
        if (type === 'xp') iconSvg = '💎';
        if (type === 'info') iconSvg = 'ℹ️';
        if (type === 'error') iconSvg = '⚠️';

        toast.innerHTML = `
            <div class="icon">${iconSvg}</div>
            <div class="message-content">
                <b>${title}</b>
                <span>${message || ''}</span>
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 5000);
    },

    // --- Event Listener using Delegation ---
addEventListeners() {
        // We add ONE listener to the body, which never gets destroyed.
        document.body.addEventListener('click', (e) => {
            console.log("--------------------");
            console.log("A click happened on the page! Target was:", e.target);

            // --- 1. Check for Sidebar Link ---
            const sidebarLink = e.target.closest('a[data-chapter-id]');
            if (sidebarLink) {
                console.log("Click identified as: Sidebar Link. Navigating...");
                e.preventDefault();
                this.renderChapter(sidebarLink.dataset.chapterId);
                return; // Stop processing
            }

            // --- 2. Check for Mission Button ---
            const missionButton = e.target.closest('.mission-btn:not(#download-cert-btn)');
            if (missionButton) {
                console.log("Click identified as: Mission Button.");
                if (!this.isReady) {
                    this.showToast('error', 'المعمل ليس جاهزًا بعد', 'يرجى الانتظار.');
                    return;
                }
                this.completeMission(missionButton.dataset.chapterId);
                return; // Stop processing
            }

            // --- 3. Check for Mission Code Download Button ---
            const missionDownloadBtn = e.target.closest('.download-code-btn');
            if (missionDownloadBtn) {
                console.log("Click identified as: Mission Code Download Button.");
                this.downloadCode(missionDownloadBtn.dataset.chapterId);
                return; // Stop processing
            }

            // --- 4. Check for Certificate Download Button ---
            // This is the most important check for the current bug.
            const downloadCertButton = e.target.closest('#download-cert-btn');
            if (downloadCertButton) {
                console.log("Click identified as: CERTIFICATE DOWNLOAD BUTTON. Starting download process...");
                
                downloadCertButton.textContent = 'جاري الإنشاء...';
                downloadCertButton.disabled = true;

                // Create a new, in-memory canvas for high-resolution download
                const highResCanvas = document.createElement('canvas');
                const highResCtx = highResCanvas.getContext('2d');
                const certWidth = 1200;
                const certHeight = 848;
                highResCanvas.width = certWidth;
                highResCanvas.height = certHeight;

                // Draw all elements onto this high-res canvas
                this.drawCertificateElements(highResCtx, this.state.userName, certWidth, certHeight);

                // Create and trigger the download link
                const link = document.createElement('a');
                const safeUserName = this.state.userName ? this.state.userName.replace(/[^a-zA-Z0-9-_\u0600-\u06FF]/g, '') : 'User';
                link.download = `شهادة-${safeUserName}.png`;
                link.href = highResCanvas.toDataURL("image/png", 1.0);
                link.click();
                
                // Re-enable button
                downloadCertButton.textContent = 'تحميل الشهادة';
                downloadCertButton.disabled = false;
                return; // Stop processing
            }

            // --- 5. Check for Reset Button ---
            const resetButton = e.target.closest('.reset-progress');
            if (resetButton) {
                console.log("Click identified as: Reset Progress Button.");
                this.resetState();
                return; // Stop processing
            }

            // If we reached here, the click was not on any of our targets.
            console.log("Click was not on a recognized target.");
        });
    }


};
export default App;