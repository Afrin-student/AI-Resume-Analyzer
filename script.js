
"use strict";

// ============================================
// RESUME IQ — ULTRA PRO MAX
// Browser-based resume analysis toolkit
// ============================================

const $ = (id) => document.getElementById(id);

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_RESUME_CHARS = 60000;
const MAX_JOB_CHARS = 30000;

let latestReport = null;

const skillGroups = {
    "Programming Languages": [
        "Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#",
        "SQL", "R", "PHP", "Ruby", "Go", "Kotlin", "Swift"
    ],
    "Web Development": [
        "HTML", "CSS", "React", "Angular", "Vue", "Node.js",
        "Express.js", "REST API", "Bootstrap", "Tailwind CSS"
    ],
    "AI, ML & Data Science": [
        "Artificial Intelligence", "Machine Learning", "Deep Learning",
        "Data Science", "Data Analysis", "TensorFlow", "PyTorch",
        "Pandas", "NumPy", "OpenCV", "Natural Language Processing",
        "Computer Vision", "Scikit-learn", "Keras", "Power BI",
        "Tableau", "Excel"
    ],
    "Databases & Tools": [
        "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Git", "GitHub",
        "Docker", "Linux", "AWS", "Azure", "Google Cloud", "Jupyter",
        "Visual Studio Code"
    ],
    "Professional Skills": [
        "Leadership", "Communication", "Teamwork", "Problem Solving",
        "Critical Thinking", "Project Management", "Time Management",
        "Adaptability", "Collaboration", "Agile"
    ]
};

const allSkills = Object.values(skillGroups).flat();

const sectionDefinitions = [
    {
        name: "Contact information",
        pattern: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b|\b(?:\+?\d[\d\s().-]{7,}\d)\b/
    },
    {
        name: "Professional summary / objective",
        pattern: /\b(summary|professional summary|career objective|objective|profile)\b/
    },
    {
        name: "Education",
        pattern: /\b(education|academic background|academic qualifications|bachelor|master|degree|university|college)\b/
    },
    {
        name: "Skills",
        pattern: /\b(skills|technical skills|core competencies|key skills|technologies)\b/
    },
    {
        name: "Work experience / internship",
        pattern: /\b(experience|work history|employment|internship|internships|professional experience)\b/
    },
    {
        name: "Projects",
        pattern: /\b(project|projects|personal projects|academic projects|key projects)\b/
    }
];

// ---------- General helpers ----------

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(text, term) {
    const flexibleTerm = escapeRegex(term).replace(/\s+/g, "\\s+");
    const pattern = new RegExp(
        "(^|[^a-z0-9])" + flexibleTerm + "(?=$|[^a-z0-9])",
        "i"
    );
    return pattern.test(text);
}

function setStatus(message, type = "") {
    const status = $("appStatus");
    status.textContent = message;
    status.className = "app-status" + (type ? " " + type : "");
}

function setReportStatus(message) {
    $("reportStatus").textContent = message;
}

function updateCounter(inputId, counterId, limit) {
    const length = $(inputId).value.length;
    $(counterId).textContent =
        length.toLocaleString() + " / " + limit.toLocaleString() + " characters";
}

function addTextElement(parent, tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
}

function renderChips(container, items, className = "keyword-chip") {
    container.replaceChildren();

    if (!items.length) {
        addTextElement(container, "span", "None detected", "empty-message");
        return;
    }

    items.forEach(item => {
        addTextElement(container, "span", item, className);
    });
}

// ---------- Skill detection ----------

function detectSkills(text) {
    const found = [];

    for (const [category, skills] of Object.entries(skillGroups)) {
        const matches = skills.filter(skill => hasTerm(text, skill));

        if (matches.length) {
            found.push({ category, skills: matches });
        }
    }

    return found;
}

function flattenSkills(groups) {
    return groups.flatMap(group => group.skills);
}

function renderSkills(groups) {
    const container = $("skillsList");
    container.replaceChildren();

    const total = flattenSkills(groups).length;
    $("noSkillsMessage").hidden = total > 0;

    groups.forEach(group => {
        const section = document.createElement("div");
        section.className = "skill-group";

        addTextElement(section, "h3", group.category);

        const chips = document.createElement("div");
        chips.className = "chip-wrap";

        group.skills.forEach(skill => {
            addTextElement(chips, "span", skill, "skill-chip");
        });

        section.appendChild(chips);
        container.appendChild(section);
    });

    $("skillCount").textContent = total;
}

// ---------- Resume section checks ----------

function detectSections(text) {
    const sections = sectionDefinitions.map(section => ({
        name: section.name,
        found: section.pattern.test(text)
    }));

    // Recognize contact links as contact information too.
    if (/\b(?:linkedin\.com|github\.com)\b/i.test(text)) {
        sections[0].found = true;
    }

    return sections;
}

function renderSections(sections) {
    const container = $("sectionChecklist");
    container.replaceChildren();

    sections.forEach(section => {
        const item = document.createElement("div");
        item.className = "check-item" + (section.found ? "" : " missing");

        addTextElement(
            item,
            "span",
            section.found ? "✓" : "!",
            "check-symbol"
        );
        addTextElement(item, "span", section.name);

        container.appendChild(item);
    });

    const count = sections.filter(section => section.found).length;
    $("sectionCount").textContent = count + " / " + sections.length;
}

// ---------- Score calculation ----------

function calculateScore(text, skills, sections, jobText) {
    const lower = text.toLowerCase();

    const sectionPoints = Math.round(
        sections.filter(section => section.found).length /
        sections.length * 30
    );

    // Reward breadth, with diminishing returns.
    const skillPoints = Math.round(
        Math.min(skills.length / 8, 1) * 30
    );

    let experiencePoints = 0;

    if (/\b(project|projects)\b/i.test(lower)) experiencePoints += 8;
    if (/\b(internship|internships|experience|employment)\b/i.test(lower)) {
        experiencePoints += 6;
    }
    if (/\b(certification|certifications|certified)\b/i.test(lower)) {
        experiencePoints += 3;
    }
    if (/\b(achievement|achievements|awards|accomplishments)\b/i.test(lower)) {
        experiencePoints += 3;
    }

    experiencePoints = Math.min(experiencePoints, 20);

    let contactPoints = 0;

    if (/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/.test(text)) {
        contactPoints += 4;
    }

    if (/\b(?:\+?\d[\d\s().-]{7,}\d)\b/.test(text)) {
        contactPoints += 3;
    }

    if (/\b(?:linkedin\.com|github\.com)\b/i.test(text)) {
        contactPoints += 3;
    }

    let jobPoints = 5;
    let jobMatch = null;

    if (jobText.trim()) {
        const jobSkills = flattenSkills(detectSkills(jobText));
        const resumeSkillSet = new Set(skills.map(skill => skill.toLowerCase()));

        const matched = jobSkills.filter(skill =>
            resumeSkillSet.has(skill.toLowerCase())
        );

        const missing = jobSkills.filter(skill =>
            !resumeSkillSet.has(skill.toLowerCase())
        );

        const matchPercent = jobSkills.length
            ? Math.round(matched.length / jobSkills.length * 100)
            : null;

        jobPoints = matchPercent === null
            ? 5
            : Math.round(matchPercent / 10);

        jobMatch = {
            total: jobSkills.length,
            matched,
            missing,
            percent: matchPercent
        };
    }

    const breakdown = [
        { label: "Resume sections", score: sectionPoints, max: 30 },
        { label: "Recognized skills", score: skillPoints, max: 30 },
        { label: "Experience & achievements", score: experiencePoints, max: 20 },
        { label: "Contact & profile links", score: contactPoints, max: 10 },
        {
            label: jobText.trim() ? "Target job skill match" : "Job alignment (neutral without job description)",
            score: jobPoints,
            max: 10
        }
    ];

    const score = Math.max(
        0,
        Math.min(100, breakdown.reduce((sum, item) => sum + item.score, 0))
    );

    return { score, breakdown, jobMatch };
}

function getLevel(score) {
    if (score >= 85) return "Strong foundation";
    if (score >= 70) return "Good progress";
    if (score >= 50) return "Needs improvement";
    return "Needs more detail";
}

function getScoreColor(score) {
    if (score >= 75) return "#55d6a5";
    if (score >= 50) return "#ffbf69";
    return "#ff818b";
}

function renderScore(score, breakdown) {
    const color = getScoreColor(score);

    $("score").textContent = score;
    $("level").textContent = getLevel(score);
    $("score").style.color = color;

    $("scoreRing").style.background =
        "conic-gradient(" + color + " " + (score * 3.6) + "deg, #28344c 0deg)";

    $("progressBar").style.width = score + "%";
    $("progressBar").style.background = color;

    $("scoreSummary").textContent =
        score >= 75
            ? "Your resume includes several useful foundations. Review the suggestions to strengthen it further."
            : score >= 50
                ? "Your resume has a starting foundation. A few targeted improvements could make it clearer."
                : "Add more relevant detail, skills, and clear resume sections before applying.";

    const container = $("scoreBreakdown");
    container.replaceChildren();

    breakdown.forEach(item => {
        const row = document.createElement("div");
        row.className = "breakdown-item";

        const top = document.createElement("div");
        top.className = "breakdown-top";

        addTextElement(top, "span", item.label);
        addTextElement(top, "span", item.score + " / " + item.max);

        const track = document.createElement("div");
        track.className = "breakdown-track";

        const fill = document.createElement("div");
        fill.className = "breakdown-fill";
        fill.style.width = (item.score / item.max * 100) + "%";

        track.appendChild(fill);
        row.append(top, track);
        container.appendChild(row);
    });
}

// ---------- Job description matching ----------

function renderJobMatch(jobMatch) {
    const card = $("jobMatchCard");

    if (!jobMatch) {
        card.hidden = true;
        $("matchPercent").textContent = "Add a job description";
        return;
    }

    card.hidden = false;

    if (jobMatch.percent === null) {
        $("matchPercent").textContent = "No known skills detected";
        $("jobMatchSummary").textContent =
            "No recognized skills from the built-in skill list were found in the job description. The match percentage cannot be calculated.";
        renderChips($("matchedKeywords"), []);
        renderChips($("missingKeywords"), []);
        return;
    }

    $("matchPercent").textContent = jobMatch.percent + "%";
    $("jobMatchSummary").textContent =
        jobMatch.matched.length + " of " + jobMatch.total +
        " recognized job-description skills also appear in your resume.";

    renderChips($("matchedKeywords"), jobMatch.matched);

    renderChips(
        $("missingKeywords"),
        jobMatch.missing,
        "keyword-chip missing"
    );
}

// ---------- Suggestions ----------

function buildSuggestions(text, skills, sections, jobMatch) {
    const suggestions = [];
    const lower = text.toLowerCase();

    if (!sections[0].found) {
        suggestions.push("Add clear contact information, including a professional email address and phone number.");
    }

    if (!sections[1].found) {
        suggestions.push("Consider adding a short professional summary or career objective tailored to the role.");
    }

    if (!sections[2].found) {
        suggestions.push("Add an Education section with your degree, institution, and graduation year.");
    }

    if (!sections[3].found || skills.length < 5) {
        suggestions.push("Make your relevant technical and professional skills easy to find. Include only skills you can demonstrate.");
    }

    if (!sections[4].found) {
        suggestions.push("If applicable, add internship, employment, volunteering, or relevant practical experience.");
    }

    if (!sections[5].found) {
        suggestions.push("Add relevant academic or personal projects. Explain your contribution, tools used, and outcomes.");
    }

    if (!/\b(certification|certifications|certified)\b/i.test(lower)) {
        suggestions.push("If you have relevant certifications, include their names and issuing organizations.");
    }

    if (!/\b(?:linkedin\.com|github\.com)\b/i.test(text)) {
        suggestions.push("Consider adding a professional LinkedIn profile or GitHub portfolio when relevant to your field.");
    }

    if (!/\b(?:developed|created|built|designed|implemented|improved|analyzed|managed|led|achieved|automated)\b/i.test(lower)) {
        suggestions.push("Use specific action verbs to explain what you did in projects and experience.");
    }

    if (!/\b(?:%|percent|increased|decreased|reduced|improved|saved|users|customers)\b/i.test(text)) {
        suggestions.push("Where accurate, include measurable results, such as time saved, accuracy achieved, or users supported.");
    }

    if (jobMatch && jobMatch.missing.length) {
        suggestions.push(
            "Review the target role's missing keywords: " +
            jobMatch.missing.slice(0, 8).join(", ") +
            ". Add them only if they truthfully describe your skills."
        );
    }

    if (!suggestions.length) {
        suggestions.push("Your resume includes the main sections checked by this tool. Tailor it to each job and proofread it before applying.");
    }

    return suggestions;
}

function renderSuggestions(suggestions) {
    const list = $("suggestions");
    list.replaceChildren();

    suggestions.forEach(suggestion => {
        addTextElement(list, "li", suggestion);
    });

    $("suggestionCount").textContent = suggestions.length;
}

// ---------- Main analysis ----------

function analyzeResume() {
    const originalText = $("resumeText").value.trim();
    const jobText = $("jobDescription").value.trim();

    if (!originalText) {
        setStatus("Please paste your resume or upload a readable PDF first.");
        $("resumeText").focus();
        return;
    }

    if (originalText.length > MAX_RESUME_CHARS) {
        setStatus("Your resume text is too long. Please keep it under 60,000 characters.");
        return;
    }

    const skills = flattenSkills(detectSkills(originalText));
    const sections = detectSections(originalText);
    const result = calculateScore(originalText, skills, sections, jobText);
    const suggestions = buildSuggestions(
        originalText,
        skills,
        sections,
        result.jobMatch
    );

    renderScore(result.score, result.breakdown);
    renderSkills(detectSkills(originalText));
    renderSections(sections);
    renderJobMatch(result.jobMatch);
    renderSuggestions(suggestions);

    latestReport = {
        score: result.score,
        level: getLevel(result.score),
        breakdown: result.breakdown,
        skills,
        sections,
        jobMatch: result.jobMatch,
        suggestions,
        analyzedAt: new Date().toLocaleString()
    };

    $("result").hidden = false;
    setStatus("Analysis complete. Review the findings below.");
    setReportStatus("");

    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- PDF upload ----------

async function handlePDFUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    $("fileStatus").textContent = "";
    setStatus("");

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        $("fileStatus").textContent = "Please select a PDF file.";
        event.target.value = "";
        return;
    }

    if (file.size > MAX_PDF_BYTES) {
        $("fileStatus").textContent = "That file is larger than 10 MB. Please choose a smaller PDF.";
        event.target.value = "";
        return;
    }

    if (typeof pdfjsLib === "undefined") {
        $("fileStatus").textContent = "PDF reader could not load. Check your internet connection and refresh the page.";
        return;
    }

    $("fileStatus").textContent = "Reading PDF...";
    $("analyzeBtn").disabled = true;

    let pdf = null;

    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

        const buffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(buffer);

        pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        let extractedText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();

            const pageText = content.items
                .map(item => item.str || "")
                .join(" ");

            extractedText += pageText + "\n";

            if (extractedText.length > MAX_RESUME_CHARS) {
                extractedText = extractedText.slice(0, MAX_RESUME_CHARS);
                break;
            }
        }

        extractedText = extractedText.trim();

        if (!extractedText) {
            $("fileStatus").textContent =
                "No selectable text found. This may be a scanned PDF; try copying its text or using OCR first.";
            return;
        }

        $("resumeText").value = extractedText;
        updateCounter("resumeText", "resumeCounter", MAX_RESUME_CHARS);

        $("fileStatus").textContent =
            file.name + " — text extracted successfully.";

        setStatus("PDF loaded. Click Analyze resume when you're ready.");
    } catch (error) {
        console.error("PDF extraction error:", error);
        $("fileStatus").textContent =
            "Could not read this PDF. Try another PDF or paste the resume text manually.";
    } finally {
        if (pdf) {
            try {
                await pdf.destroy();
            } catch (_) {
                // Ignore cleanup errors.
            }
        }

        $("analyzeBtn").disabled = false;
    }
}

// ---------- Report generation ----------

function makeReportText() {
    if (!latestReport) return "";

    const report = latestReport;
    const lines = [
        "RESUME IQ — RESUME ANALYSIS REPORT",
        "===================================",
        "",
        "Analysis date: " + report.analyzedAt,
        "Resume score estimate: " + report.score + "/100",
        "Assessment: " + report.level,
        "",
        "IMPORTANT",
        "This is a browser-based heuristic estimate, not an official ATS score or hiring prediction.",
        "",
        "SCORE BREAKDOWN",
        "--------------",
        ...report.breakdown.map(item =>
            item.label + ": " + item.score + "/" + item.max
        ),
        "",
        "SKILLS DETECTED",
        "---------------",
        ...(report.skills.length ? report.skills : ["No recognized skills detected."]),
        "",
        "RESUME SECTIONS",
        "---------------",
        ...report.sections.map(section =>
            (section.found ? "[FOUND] " : "[MISSING] ") + section.name
        ),
        "",
        "JOB DESCRIPTION MATCH",
        "----------------------"
    ];

    if (report.jobMatch) {
        lines.push(
            report.jobMatch.percent === null
                ? "Match percentage unavailable: no recognized job skills."
                : "Recognized skill match: " + report.jobMatch.percent + "%",
            "Matched skills: " + (report.jobMatch.matched.join(", ") || "None detected"),
            "Skills to review: " + (report.jobMatch.missing.join(", ") || "None detected")
        );
    } else {
        lines.push("No job description supplied.");
    }

    lines.push("", "SUGGESTED IMPROVEMENTS", "---------------------");

    report.suggestions.forEach((suggestion, index) => {
        lines.push((index + 1) + ". " + suggestion);
    });

    lines.push(
        "",
        "Generated locally by ResumeIQ.",
        "Check every finding for accuracy before changing your resume."
    );

    return lines.join("\n");
}

function downloadReport() {
    if (!latestReport) {
        setReportStatus("Analyze your resume before downloading a report.");
        return;
    }

    const blob = new Blob([makeReportText()], {
        type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ResumeIQ_Analysis_Report.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setReportStatus("Your report download has started.");
}

async function copyReport() {
    if (!latestReport) {
        setReportStatus("Analyze your resume before copying a report.");
        return;
    }

    const text = makeReportText();

    try {
        await navigator.clipboard.writeText(text);
        setReportStatus("Report copied to clipboard.");
    } catch (_) {
        // Fallback for browsers where Clipboard API is unavailable.
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();

        const copied = document.execCommand("copy");
        area.remove();

        setReportStatus(
            copied
                ? "Report copied to clipboard."
                : "Copy was blocked by the browser. Use Download report instead."
        );
    }
}

// ---------- Reset and initialization ----------

function resetAll() {
    $("resumeText").value = "";
    $("jobDescription").value = "";
    $("pdfUpload").value = "";

    $("fileStatus").textContent = "No PDF selected";
    $("result").hidden = true;

    latestReport = null;

    updateCounter("resumeText", "resumeCounter", MAX_RESUME_CHARS);
    updateCounter("jobDescription", "jobCounter", MAX_JOB_CHARS);

    setStatus("All fields cleared.");
    setReportStatus("");
    $("resumeText").focus();
}

document.addEventListener("DOMContentLoaded", () => {
    $("analyzeBtn").addEventListener("click", analyzeResume);
    $("pdfUpload").addEventListener("change", handlePDFUpload);
    $("downloadBtn").addEventListener("click", downloadReport);
    $("copyBtn").addEventListener("click", copyReport);
    $("resetBtn").addEventListener("click", resetAll);

    $("clearTextBtn").addEventListener("click", () => {
        $("resumeText").value = "";
        $("pdfUpload").value = "";
        $("fileStatus").textContent = "No PDF selected";
        updateCounter("resumeText", "resumeCounter", MAX_RESUME_CHARS);
        setStatus("Resume text cleared.");
    });

    $("resumeText").addEventListener("input", () => {
        updateCounter("resumeText", "resumeCounter", MAX_RESUME_CHARS);
    });

    $("jobDescription").addEventListener("input", () => {
        updateCounter("jobDescription", "jobCounter", MAX_JOB_CHARS);
    });

    updateCounter("resumeText", "resumeCounter", MAX_RESUME_CHARS);
    updateCounter("jobDescription", "jobCounter", MAX_JOB_CHARS);

    if (typeof pdfjsLib !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    }
});

