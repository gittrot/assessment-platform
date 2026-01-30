/**
 * GET endpoint to show a question page for candidates
 * GET /sessions/{sessionId}/question
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getNextQuestion } from './sessions';

const API_ENDPOINT = process.env.API_ENDPOINT || 'https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/';

export async function getQuestionPage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        },
        body: '<html><body><h1>Error</h1><p>Session ID is required</p></body></html>'
      };
    }

    // Get tenantId from query parameters if available
    const queryParams = event.queryStringParameters || {};
    const tenantId = queryParams.tenantId;

    // Get the question data by calling getNextQuestion
    // We'll need to modify getNextQuestion to return the data we need
    // For now, let's create a page that fetches the question via JavaScript
    
    const questionUrl = `${API_ENDPOINT}sessions/${sessionId}/next-question${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`;
    const sessionIdJson = JSON.stringify(sessionId);
    const questionUrlJson = JSON.stringify(questionUrl);
    const apiEndpointJson = JSON.stringify(API_ENDPOINT);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assessment Question</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    * {
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 800px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 24px;
    }
    .question-container {
      margin: 20px 0;
    }
    .question-text {
      font-size: 18px;
      line-height: 1.6;
      margin-bottom: 20px;
      color: #333;
    }
    .question-text .code-block code, .option .code-block code {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      background: transparent;
      color: #e0e0e0;
      padding: 0;
      border-radius: 0;
    }
    .question-text code, .option code {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      background: #f0f0f0;
      color: #333;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .option.selected code { background: rgba(255,255,255,0.25); color: inherit; }
    .code-block {
      display: block;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      background: #1e1e1e;
      color: #e0e0e0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
      white-space: pre;
      line-height: 1.5;
    }
    .options {
      list-style: none;
      margin: 20px 0;
    }
    .option {
      background: #f5f5f5;
      padding: 15px;
      margin: 10px 0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid transparent;
    }
    .option:hover {
      background: #e8e8e8;
      border-color: #667eea;
    }
    .option.selected {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }
    .coding-area {
      width: 100%;
      min-height: 200px;
      padding: 15px;
      border: 2px solid #ddd;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      margin: 20px 0;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
    .submit-btn {
      width: 100%;
      background: #667eea;
      color: white;
      border: none;
      padding: 16px;
      border-radius: 6px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.3s;
      margin-top: 20px;
    }
    .submit-btn:hover {
      background: #5568d3;
    }
    .submit-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: none;
    }
    .loading {
      text-align: center;
      color: #667eea;
      padding: 20px;
    }
    .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 3px solid #e0e0e0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 10px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .progress {
      margin-bottom: 20px;
      color: #666;
      font-size: 14px;
    }
    .thank-you { margin-top: 24px; }
    #timer {
      font-family: 'Courier New', monospace;
    }
    #timer.warning {
      color: #ff6b6b;
      background: #ffe0e0;
      animation: pulse 1s infinite;
    }
    #timer.critical {
      color: #fff;
      background: #ff4444;
      animation: pulse 0.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h1 style="margin: 0;">Assessment Question</h1>
      <div id="timer" style="display: none; font-size: 20px; font-weight: bold; color: #667eea; padding: 10px 20px; background: #f0f0f0; border-radius: 8px; min-width: 120px; text-align: center;">
        <span id="timerText">--:--</span>
      </div>
    </div>
    <div class="progress" id="progress">Loading question...</div>
    <div class="error" id="error"></div>
    <div class="loading" id="loading"><span class="spinner"></span>Generating your next question...</div>
    
    <div id="questionContainer" style="display: none;">
      <div class="question-text" id="questionText"></div>
      
      <ul class="options" id="optionsList" style="display: none;"></ul>
      
      <textarea class="coding-area" id="codingAnswer" placeholder="Enter your code here..." style="display: none;" oncopy="return false" oncut="return false" onpaste="return false"></textarea>
      
      <input type="text" id="textAnswer" placeholder="Enter your answer..." style="display: none; width: 100%; padding: 12px; margin: 20px 0; border: 2px solid #ddd; border-radius: 6px; font-size: 16px;" oncopy="return false" oncut="return false" onpaste="return false">
      
      <button class="submit-btn" id="submitBtn" onclick="submitAnswer()">Submit Answer</button>
    </div>
    <div id="thankYou" style="display: none;" class="thank-you">
      <p style="font-size: 18px; color: #333; margin-bottom: 12px;">Thank you for completing the assessment.</p>
      <p style="font-size: 14px; color: #666;">You can close this tab.</p>
    </div>
  </div>

  <script>
    const sessionId = ${sessionIdJson};
    const questionUrl = ${questionUrlJson};
    const _API = ${apiEndpointJson};
    let currentQuestion = null;
    let selectedAnswer = null;
    let currentInputMode = 'text';
    let maxQuestions = 10; // Will be updated from API response
    let durationMinutes = null;
    let startedAt = null;
    let timerInterval = null;

    // Right-click is now enabled - removed prevention
    document.addEventListener('keydown', function(e) {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+C, Ctrl+A, Ctrl+V, Ctrl+X
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
          (e.ctrlKey && (e.key === 'U' || e.key === 'C' || e.key === 'A' || e.key === 'V' || e.key === 'X')) ||
          (e.metaKey && (e.key === 'C' || e.key === 'A' || e.key === 'V' || e.key === 'X'))) {
        // Allow Ctrl+C/V/X/A only in input fields (coding answer, text answer)
        var target = e.target || e.srcElement;
        var isInput = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
        if (!isInput) {
          e.preventDefault();
          return false;
        }
      }
    });
    // Disable copy, cut, paste events on non-input elements
    document.addEventListener('copy', function(e) {
      var target = e.target || e.srcElement;
      var isInput = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
      if (!isInput) {
        e.preventDefault();
        return false;
      }
    });
    document.addEventListener('cut', function(e) {
      var target = e.target || e.srcElement;
      var isInput = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
      if (!isInput) {
        e.preventDefault();
        return false;
      }
    });
    document.addEventListener('paste', function(e) {
      var target = e.target || e.srcElement;
      var isInput = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');
      if (!isInput) {
        e.preventDefault();
        return false;
      }
    });
    // Text selection is now enabled - removed prevention

    async function loadQuestion() {
      const loadingDiv = document.getElementById('loading');
      const errorDiv = document.getElementById('error');
      const questionContainer = document.getElementById('questionContainer');
      const progressDiv = document.getElementById('progress');
      
      try {
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        questionContainer.style.display = 'none';
        progressDiv.textContent = 'Generating your next question...';
        
        const response = await fetch(questionUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        var data;
        try {
          data = await response.json();
        } catch (e) {
          throw new Error('Invalid response from server. Check network or try again.');
        }
        
        if (response.ok && data.question) {
          currentQuestion = data.question;
          if (data.maxQuestions) maxQuestions = data.maxQuestions;
          if (data.durationMinutes) durationMinutes = data.durationMinutes;
          if (data.startedAt) startedAt = data.startedAt;
          try {
            displayQuestion(data.question, data.questionsAnswered || 0);
          } catch (e) {
            throw new Error('Could not display question: ' + (e && e.message ? e.message : 'Unknown error'));
          }
          loadingDiv.style.display = 'none';
          questionContainer.style.display = 'block';
          // Start timer if duration is set
          if (durationMinutes && startedAt) {
            startTimer();
          }
        } else if (response.ok && data.message && ('' + data.message).includes('Maximum')) {
          loadingDiv.style.display = 'none';
          questionContainer.style.display = 'none';
          completeAndShowThankYou();
          return;
        } else {
          var msg = (data && data.error && data.error.message) ? data.error.message : (data && data.message) ? data.message : 'Failed to load question';
          throw new Error(msg);
        }
      } catch (error) {
        loadingDiv.style.display = 'none';
        questionContainer.style.display = 'none';
        errorDiv.textContent = 'Error: ' + (error && error.message ? error.message : String(error));
        errorDiv.style.display = 'block';
      }
    }

    async function completeAndShowThankYou() {
      var progressDiv = document.getElementById('progress');
      var errorDiv = document.getElementById('error');
      var questionContainer = document.getElementById('questionContainer');
      var thankYou = document.getElementById('thankYou');
      var loadingDiv = document.getElementById('loading');
      var qp = new URLSearchParams(window.location.search);
      var tid = qp.get('tenantId');
      progressDiv.textContent = 'Submitting your assessment...';
      if (loadingDiv) loadingDiv.style.display = 'block';
      errorDiv.style.display = 'none';
      if (questionContainer) questionContainer.style.display = 'none';
      if (thankYou) thankYou.style.display = 'none';
      try {
        var submitUrl = _API + 'sessions/' + sessionId + '/submit' + (tid ? '?tenantId=' + encodeURIComponent(tid) : '');
        var res = await fetch(submitUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
        var json = {};
        try { json = await res.json(); } catch (e) {}
        if (res.ok) {
          if (loadingDiv) loadingDiv.style.display = 'none';
          progressDiv.textContent = '';
          if (thankYou) thankYou.style.display = 'block';
        } else {
          throw new Error((json && json.error && json.error.message) ? json.error.message : 'Failed to submit assessment');
        }
      } catch (e) {
        if (loadingDiv) loadingDiv.style.display = 'none';
        progressDiv.textContent = '';
        errorDiv.textContent = 'Error: ' + (e && e.message ? e.message : String(e));
        errorDiv.style.display = 'block';
      }
    }

    function startTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      
      const timerElement = document.getElementById('timer');
      const timerText = document.getElementById('timerText');
      if (!timerElement || !timerText) return;
      
      timerElement.style.display = 'block';
      
      function updateTimer() {
        if (!startedAt || !durationMinutes) return;
        
        const startTime = new Date(startedAt).getTime();
        const durationMs = durationMinutes * 60 * 1000;
        const endTime = startTime + durationMs;
        const now = Date.now();
        const remaining = endTime - now;
        
        if (remaining <= 0) {
          // Time's up!
          clearInterval(timerInterval);
          timerText.textContent = '00:00';
          timerElement.className = 'critical';
          // Auto-submit the assessment
          setTimeout(() => {
            completeAndShowThankYou();
          }, 1000);
          return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const formatted = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        timerText.textContent = formatted;
        
        // Change color based on remaining time
        const percentRemaining = remaining / durationMs;
        timerElement.className = '';
        if (percentRemaining <= 0.1) {
          timerElement.className = 'critical';
        } else if (percentRemaining <= 0.25) {
          timerElement.className = 'warning';
        }
      }
      
      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);
    }

    function escapeHtml(s) {
      if (s == null || typeof s !== 'string') return '';
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    function formatTextWithCode(s) {
      try {
        if (!s || typeof s !== 'string') return '';
        var t = escapeHtml(s);
        var B = String.fromCharCode(96);
        var N = String.fromCharCode(10);
        var blocks = [];
        var pf = '___CBP';
        var triple = B + B + B;
        var idx = 0;
        while (true) {
          var a = t.indexOf(triple, idx);
          if (a === -1) break;
          var b = a + 3;
          while (b < t.length) {
            var c = t.charCodeAt(b);
            if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 45 || c === 43 || c === 35) { b++; continue; }
            break;
          }
          if (t[b] === N) b++;
          var e = t.indexOf(triple, b);
          if (e === -1) break;
          var code = t.substring(b, e);
          var start = 0;
          while (start < code.length && code[start] === N) start++;
          var end = code.length;
          while (end > start && code[end - 1] === N) end--;
          code = code.substring(start, end);
          var i = blocks.length;
          blocks.push('<pre class="code-block"><code>' + escapeHtml(code) + '</code></pre>');
          t = t.substring(0, a) + pf + i + '___' + t.substring(e + 3);
          idx = a + pf.length + String(i).length + 3;
        }
        idx = 0;
        while (true) {
          var u = t.indexOf(B, idx);
          if (u === -1) break;
          var v = t.indexOf(B, u + 1);
          if (v === -1) break;
          var inner = t.substring(u + 1, v);
          t = t.substring(0, u) + '<code>' + escapeHtml(inner) + '</code>' + t.substring(v + 1);
          idx = u + 6 + inner.length + 7;
        }
        for (var j = 0; j < blocks.length; j++) {
          var ph = pf + j + '___';
          var k = t.indexOf(ph);
          if (k !== -1) t = t.substring(0, k) + blocks[j] + t.substring(k + ph.length);
        }
        var out = '';
        for (var n = 0; n < t.length; n++) {
          if (t[n] === N) out += '<br>'; else out += t[n];
        }
        return out;
      } catch (e) {
        return escapeHtml(String(s));
      }
    }
    function getDisplayOptions(question) {
      var opts = question.options;
      if (!opts) return [];
      if (Array.isArray(opts)) {
        return opts.map(function (o) {
          if (o == null) return '';
          if (typeof o === 'string') return o.trim();
          if (typeof o === 'object' && o !== null) {
            var t = o.text || o.label || o.value || o.option || o.choice;
            return (t != null ? String(t) : '').trim();
          }
          return String(o).trim();
        }).filter(Boolean);
      }
      if (typeof opts === 'object') {
        var keys = Object.keys(opts).sort();
        return keys.map(function (k) { var v = opts[k]; return v != null ? String(v).trim() : ''; }).filter(Boolean);
      }
      return [];
    }

    function displayQuestion(question, questionsAnswered) {
      const questionText = document.getElementById('questionText');
      const optionsList = document.getElementById('optionsList');
      const codingAnswer = document.getElementById('codingAnswer');
      const textAnswer = document.getElementById('textAnswer');
      const progressDiv = document.getElementById('progress');
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) submitBtn.disabled = false;

      questionText.innerHTML = formatTextWithCode(question.questionText || '');
      optionsList.innerHTML = '';
      codingAnswer.value = '';
      textAnswer.value = '';
      selectedAnswer = null;

      progressDiv.textContent = 'Question ' + (questionsAnswered + 1) + ' of ' + maxQuestions;
      
      var displayOptions = getDisplayOptions(question);
      var _qt = question.questionType ? String(question.questionType).toUpperCase() : '';
      var qt = '';
      var sp = function(c) { var n = c.charCodeAt(0); return n === 32 || n === 9 || n === 10 || n === 13; };
      for (var zi = 0; zi < _qt.length; zi++) {
        var ch = _qt[zi];
        if (sp(ch)) { if (!qt.length || qt[qt.length-1] !== '_') qt += '_'; }
        else qt += ch;
      }
      var isMcq = (qt === 'MCQ' || qt === 'MULTIPLE_CHOICE' || qt === 'MULTIPLECHOICE') && displayOptions.length > 0;
      if (!isMcq && displayOptions.length > 0) isMcq = true;

      var isCoding = String(question.questionType || '').toUpperCase() === 'CODING';

      if (isMcq) {
        currentInputMode = 'mcq';
        optionsList.style.display = 'block';
        codingAnswer.style.display = 'none';
        textAnswer.style.display = 'none';
        displayOptions.forEach(function (option) {
          var li = document.createElement('li');
          li.className = 'option';
          li.innerHTML = formatTextWithCode(option);
          li.onclick = function () {
            document.querySelectorAll('.option').forEach(function (opt) { opt.classList.remove('selected'); });
            li.classList.add('selected');
            selectedAnswer = option;
          };
          optionsList.appendChild(li);
        });
      } else if (isCoding) {
        currentInputMode = 'coding';
        optionsList.style.display = 'none';
        codingAnswer.style.display = 'block';
        textAnswer.style.display = 'none';
      } else {
        currentInputMode = 'text';
        optionsList.style.display = 'none';
        codingAnswer.style.display = 'none';
        textAnswer.style.display = 'block';
      }
    }

    async function submitAnswer() {
      if (!currentQuestion) return;
      
      const submitBtn = document.getElementById('submitBtn');
      const errorDiv = document.getElementById('error');
      const codingAnswer = document.getElementById('codingAnswer');
      const textAnswer = document.getElementById('textAnswer');
      
      var answer;
      if (currentInputMode === 'mcq') {
        answer = selectedAnswer;
      } else if (currentInputMode === 'coding') {
        answer = codingAnswer.value;
      } else {
        answer = textAnswer.value;
      }
      
      if (!answer || answer.trim() === '') {
        errorDiv.textContent = 'Please provide an answer';
        errorDiv.style.display = 'block';
        return;
      }
      
      submitBtn.disabled = true;
      errorDiv.style.display = 'none';
      
      try {
        // Include tenantId in the answer URL if available
        const urlParams = new URLSearchParams(window.location.search);
        const tenantId = urlParams.get('tenantId');
        const answerUrl = _API + 'sessions/' + sessionId + '/answer' + (tenantId ? '?tenantId=' + encodeURIComponent(tenantId) : '');
        const response = await fetch(answerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            questionId: currentQuestion.questionId,
            answer: answer,
            timeSpentSeconds: 0 // You can track time if needed
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Don't show results, just proceed to next question or complete
          var questionsAnswered = data.questionsAnswered || 0;
          if (data.maxQuestions) maxQuestions = data.maxQuestions;
          if (questionsAnswered >= maxQuestions || !data.nextQuestionAvailable) {
            completeAndShowThankYou();
          } else {
            loadQuestion();
          }
        } else {
          throw new Error(data.error?.message || 'Failed to submit answer');
        }
      } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
      }
    }

    // Cleanup timer on page unload
    window.addEventListener('beforeunload', function() {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    });

    // Load question on page load
    loadQuestion();
  </script>
</body>
</html>
    `.trim();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '3600'
      },
      body: html
    };
  } catch (error) {
    console.error('Error generating question page:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      },
      body: '<html><body><h1>Error</h1><p>An error occurred while loading the question page.</p></body></html>'
    };
  }
}
