(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RoshanRAG = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EVIDENCE_LABELS = {
    user_confirmed: "confirmed",
    user_reported_event: "reported",
    historical_record: "historical",
    assistant_inference: "inference",
    unverified_claim: "unverified",
    unknown: "unknown",
    reference: "reference"
  };

  const STOP = new Set(
    "a an the is are was were be been am i you your yours my me do does did of to in on for with and or at by from it this that what which who how why can could would should about tell more any please there their have has had its into out up so if as".split(" ")
  );

  const SYN = {
    job: "placement role",
    placement: "job campus",
    hire: "job contact",
    hiring: "job contact",
    recruit: "placement job",
    career: "role placement study tradeoff",
    uncertainty: "tradeoff study career",
    tradeoff: "career study",
    fde: "forward deployed deployment engineer",
    deploy: "deployment forward fde",
    deployment: "forward fde",
    forward: "fde deployed",
    intern: "vdart experience",
    internship: "vdart intern",
    experience: "vdart intern",
    learn: "learning intuition style",
    learning: "learn style",
    study: "learning gate postgraduate",
    teach: "mentor mentoring",
    mentor: "mentoring intern teach",
    master: "msc postgraduate study",
    msc: "postgraduate study uk",
    abroad: "uk postgraduate",
    uk: "msc postgraduate",
    higher: "postgraduate study",
    cert: "certificate credential badge",
    certification: "certificate",
    badge: "certificate",
    course: "certificate",
    hobby: "interest cricket football video",
    hobbies: "interest cricket football video",
    sport: "cricket football",
    cricket: "sport",
    contact: "email linkedin phone reach",
    email: "contact",
    resume: "contact skills",
    cv: "contact skills",
    rag: "retrieval bot",
    chatbot: "bot retrieval",
    bot: "chat retrieval",
    chat: "bot",
    llm: "bot",
    tech: "stack skills",
    stack: "skills python",
    language: "skills python",
    coding: "skills python",
    code: "skills python",
    psych: "psychology emotional",
    psychology: "emotional intelligence",
    edit: "video premiere",
    video: "premiere editing",
    think: "reasoning learning",
    mindset: "learning reasoning",
    strength: "skills reasoning",
    strengths: "skills",
    goal: "now role study",
    future: "study role",
    plan: "now role study",
    next: "now study",
    prepar: "placement dsa gate",
    preparing: "placement dsa",
    build: "project",
    built: "project",
    made: "project",
    project: "built",
    app: "project",
    gate: "da placement",
    dsa: "placement",
    interview: "interview prep project",
    mock: "interview",
    cloud: "aws",
    aws: "cloud",
    azure: "cloud",
    python: "skills",
    pytorch: "skills",
    ml: "machine learning",
    nlp: "sentiment",
    bio: "biology",
    biology: "computational space",
    space: "satellite",
    satellite: "space",
    mentoring: "mentor",
    demo: "demos industry",
    visiting: "industry visit",
    football: "sport",
    sports: "cricket football",
    school: "education",
    college: "vit bhopal education",
    university: "vit bhopal education",
    degree: "education btech",
    where: "location trichy",
    live: "trichy",
    from: "trichy",
    communication: "learning style direct",
    direct: "communication",
    private: "privacy boundary",
    privacy: "public boundary private",
    public: "privacy boundary",
    sensitive: "privacy boundary",
    movie: "preferences unknown",
    movies: "preferences unknown",
    film: "preferences unknown",
    films: "preferences unknown",
    music: "preferences unknown",
    singer: "preferences unknown",
    song: "preferences unknown",
    favorite: "preferences unknown",
    favourite: "preferences unknown",
    game: "preferences unknown",
    games: "preferences unknown",
    book: "preferences unknown",
    books: "preferences unknown",
    anime: "preferences unknown",
    bayes: "probability learning",
    probability: "bayes learning",
    spam: "bayes mentor",
    mode: "chat",
    technical: "project skills",
    personal: "communication career preferences"
  };

  const PRIVATE_RE = /\b(cgpa|gpa|backlogs?|arrears?|attendance|credits?|grades?|marks|percentage|date of birth|birth ?date|birth ?time|birthplace|born|dob|how old|age|horoscope|astrolog\w*|rasi|nakshatra|zodiac|sun sign|moon sign|star sign|skin|acne|health|medical|mental|hairline|hair|sleep|insomnia|adhd|autism|bipolar|disorder|diagnos\w*|trauma|loan|money|salary|ctc|package|bank|income|financial|finances|debt|savings|expenses|family|parents?|mother|father|girlfriend|boyfriend|dating|romantic|crush|relationship|love life|romantic life|single|married|marriage|partner|spouse|lonel\w*|depress\w*|anxiety|stress\w*|personality|mbti|introvert|extrovert|attachment style|caste|religion|community|politic\w*|political|sexual|orientation|hostel|room|block 1|748|address|street|pin ?code|postal code|exact location|upi|account number|card number|cvv|otp|token|secret key|private key|purse|wallet|theatre|theater|instagram|password|api key|smil(?:e|ed|ing))\b/;

  const ALWAYS_PRIVATE = /\b(purse|wallet|theatre|theater|hostel|room 748|block 1|acne|isotretinoin|bank balance|karur|radha|balakumar)\b/;

  const PERSONAL_SUBJECT = /\b(i|me|my|mine|you|your|yours|roshan|he|him|his|she|her|hers|they|them|their)\b/;

  const MODE_CATEGORIES = {
    portfolio: null,
    technical: new Set(["projects", "skills", "learning", "meta"]),
    personal: new Set(["identity", "career", "learning", "interests", "preferences", "meta", "contact"]),
    interview: new Set(["projects", "skills", "career", "learning", "identity", "meta"]),
    learning: new Set(["learning", "skills", "projects", "meta"])
  };

  const MODE_LABELS = {
    auto: "Auto",
    portfolio: "Portfolio",
    technical: "Technical",
    personal: "Personal",
    interview: "Interview",
    learning: "Learning"
  };

  const INTERVIEW_QUESTIONS = [
    {
      q: "Walk me through your flagship project. What problem did it solve, and what did you personally build?",
      id: "library"
    },
    {
      q: "Tell me about a technical trade-off you made and why.",
      id: "policy"
    },
    {
      q: "How did you mentor interns, and how did you check that they understood?",
      id: "mentor"
    },
    {
      q: "Which project are you most proud of, and what would you change now?",
      id: "library"
    },
    {
      q: "Why are you targeting forward deployed engineering roles?",
      id: "roles"
    },
    {
      q: "What is still a prototype in your portfolio, and what would production require?",
      id: "plant"
    }
  ];

  const INTERVIEW_FOLLOW_UPS = {
    library: "Follow-up: if inference cost doubled, which of the 10 modules would you cut first and why?",
    policy: "Follow-up: where exactly does the deterministic rules engine stop and the RAG layer begin?",
    synthetic: "Follow-up: how do you validate that synthetic data preserves privacy without destroying utility?",
    plant: "Follow-up: what evidence would you need before calling this production-ready?",
    timetable: "Follow-up: what happens when the constraint solver cannot find a valid timetable?",
    bus: "Follow-up: how would the QR attendance flow change for a live deployment?",
    mentor: "Follow-up: how did you measure whether a beginner actually understood the concept?",
    roles: "Follow-up: what part of forward deployed work is hardest to demonstrate in an interview?",
    now: "Follow-up: how are you splitting preparation time between placements and GATE DA?",
    study: "Follow-up: what evidence would make you choose work-first over a master's?"
  };

  function fillTemplate(text, vars) {
    return String(text || "").replace(/\{\{([A-Z0-9_]+)\}\}/g, function (_, key) {
      return vars[key] === undefined ? "{{" + key + "}}" : String(vars[key]);
    });
  }

  function stem(word) {
    return word.length > 4 ? word.replace(/(ing|ed|es|s|e)$/, "") : word;
  }

  function toks(value) {
    return (String(value || "").toLowerCase().match(/[a-z0-9+#]+/g) || [])
      .filter(function (word) { return !STOP.has(word); })
      .map(stem);
  }

  function classifyQuery(query, forcedMode) {
    if (forcedMode && forcedMode !== "auto" && Object.prototype.hasOwnProperty.call(MODE_CATEGORIES, forcedMode)) {
      return forcedMode;
    }
    const text = String(query || "").toLowerCase();
    if (/\b(interview|mock interview|ask me|practice interview|hiring manager|walk me through)\b/.test(text)) return "interview";
    if (/\b(how do you learn|your learning|your style|how do you work|your communication|your career|your goal|your plan|your interest|your hobby|favorite|favourite|your private|what do you keep private)\b/.test(text)) return "personal";
    if (/\b(project|architecture|stack|code|implementation|model|synthetic|policy|library|maze|tech)\b/.test(text)) return "technical";
    if (/\b(teach me|explain|intuition|tutorial|how does .* work|bayes|probability|gradient|transformer|rag|bm25|algorithm)\b/.test(text)) return "learning";
    return "portfolio";
  }

  function privacyCheck(query) {
    const text = String(query || "").toLowerCase();
    if (ALWAYS_PRIVATE.test(text)) return true;
    return PRIVATE_RE.test(text) && PERSONAL_SUBJECT.test(text);
  }

  function evidenceLabel(type) {
    return EVIDENCE_LABELS[type] || "";
  }

  function create(kb, options) {
    if (!kb || !Array.isArray(kb.entries)) throw new Error("A knowledge bundle with entries is required.");
    const opts = options || {};
    const vars = Object.assign({ CERTS_COUNT: opts.certCount === undefined ? 61 : opts.certCount }, opts.vars || {});
    const defaultChips = Array.isArray(kb.defaultChips) ? kb.defaultChips.slice(0, 5) : [];

    const entries = kb.entries
      .filter(function (entry) {
        return entry && entry.public !== false && (entry.sensitivity === "public" || entry.sensitivity === "low");
      })
      .map(function (entry) {
        return Object.assign({}, entry, {
          title: fillTemplate(entry.title, vars),
          text: fillTemplate(entry.text, vars),
          next: Array.isArray(entry.next) ? entry.next.slice(0, 4) : []
        });
      });

    if (!entries.length) throw new Error("No public knowledge entries are available.");

    const byId = new Map(entries.map(function (entry) { return [entry.id, entry]; }));
    const byTitle = new Map(entries.map(function (entry) { return [entry.title.toLowerCase(), entry]; }));

    const docs = entries.map(function (entry) {
      const tokens = toks(entry.title + " " + entry.title + " " + entry.kw + " " + entry.kw + " " + entry.text + " " + entry.retrieval_tags.join(" "));
      const tf = new Map();
      tokens.forEach(function (token) { tf.set(token, (tf.get(token) || 0) + 1); });
      return { n: entry, tf: tf, len: tokens.length };
    });

    const AVG = docs.reduce(function (sum, doc) { return sum + doc.len; }, 0) / docs.length;
    const DF = new Map();
    docs.forEach(function (doc) {
      doc.tf.forEach(function (_, key) { DF.set(key, (DF.get(key) || 0) + 1); });
    });
    const idf = function (key) {
      return Math.log(1 + (docs.length - (DF.get(key) || 0) + 0.5) / ((DF.get(key) || 0) + 0.5));
    };

    function expand(query) {
      const expanded = new Map();
      const base = (String(query || "").toLowerCase().match(/[a-z0-9+#]+/g) || []).filter(function (word) { return !STOP.has(word); });
      const generic = new Set(["project", "projects", "built", "build", "made", "app", "apps"]);
      const allGeneric = base.length > 0 && base.every(function (word) { return generic.has(word); });
      base.forEach(function (word) {
        const key = stem(word);
        expanded.set(key, Math.max(expanded.get(key) || 0, generic.has(word) && !allGeneric ? 0.05 : 1));
        const synonyms = generic.has(word) && !allGeneric ? null : (SYN[word] || SYN[key]);
        if (synonyms) {
          synonyms.split(" ").forEach(function (synonym) {
            const synonymKey = stem(synonym);
            expanded.set(synonymKey, Math.max(expanded.get(synonymKey) || 0, 0.45));
          });
        }
      });
      return expanded;
    }

    function isHistoricalQuery(query) {
      return /\b(history|historical|old|previous|earlier|used to|before|outdated)\b/.test(String(query || "").toLowerCase());
    }

    function retrieve(query, mode) {
      const categories = MODE_CATEGORIES[mode] || null;
      const historical = isHistoricalQuery(query);
      let pool = categories ? docs.filter(function (doc) { return categories.has(doc.n.category); }) : docs.slice();
      if (categories && !pool.length) pool = docs.slice();
      pool = pool.filter(function (doc) { return doc.n.is_current !== false || historical; });
      const queryTokens = expand(query);
      return pool
        .map(function (doc) {
          let score = 0;
          queryTokens.forEach(function (weight, key) {
            const frequency = doc.tf.get(key) || 0;
            if (!frequency) return;
            score += weight * idf(key) * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * doc.len / AVG));
          });
          return { n: doc.n, score: score };
        })
        .filter(function (result) { return result.score > 0; })
        .sort(function (a, b) { return b.score - a.score; });
    }

    function hit(ids, mode) {
      const notes = ids.map(function (id) { return byId.get(id); }).filter(Boolean);
      if (!notes.length) return null;
      return {
        kind: "hit",
        text: notes.map(function (note) { return note.text; }),
        sources: notes,
        next: notes[0].next,
        sec: notes[0].sec,
        mode: mode
      };
    }

    function aboutAnswer(mode) {
      return hit(["about"], mode);
    }

    function privacyAnswer(mode) {
      const note = byId.get("public_boundary");
      return {
        kind: "private",
        text: [note ? note.text : "I keep health, finances, family, relationships, and precise location private. The public chat only uses notes I am comfortable sharing."],
        sources: note ? [note] : [],
        next: note ? note.next : defaultChips.slice(0, 3),
        sec: note ? note.sec : null,
        mode: mode
      };
    }

    function missAnswer(mode) {
      return {
        kind: "miss",
        text: ["I don't have that in my public notes, and I'd rather say so than guess. I can talk about my projects, how I learn and work, what I'm preparing for, VDART mentoring, skills, certificates, interests, and safe career context. Sensitive personal details stay private."],
        next: defaultChips,
        mode: mode
      };
    }

    let interviewIndex = 0;
    function nextInterviewQuestion() {
      const item = INTERVIEW_QUESTIONS[interviewIndex % INTERVIEW_QUESTIONS.length];
      interviewIndex += 1;
      return item;
    }

    function followUpAnswer(query, last, mode) {
      const text = String(query || "").toLowerCase().trim();
      const wantsMore = /^(tell me more|more|continue|go on|expand|elaborate|example|why|how so|and\?|what about that)\b/.test(text) ||
        /\b(tell me more|go deeper|expand on that|elaborate on that|what do you mean|can you elaborate|please elaborate)\b/.test(text);
      if (!wantsMore || !last || !last.id) return null;
      const base = byId.get(last.id);
      if (!base) return null;
      function findRelated(chip) {
        const direct = byTitle.get(String(chip || "").toLowerCase());
        if (direct) return direct;
        const hits = retrieve(chip, null);
        return hits.length && hits[0].score >= 1.6 ? hits[0].n : null;
      }
      const related = (base.next || [])
        .map(findRelated)
        .find(function (note) { return note && note.id !== base.id; });
      const picks = related ? [base, related] : [base];
      return {
        kind: "hit",
        text: picks.map(function (note) { return note.text; }),
        sources: picks,
        next: base.next,
        sec: base.sec,
        mode: last.mode || mode,
        followUp: true
      };
    }

    function answer(query, answerOptions) {
      const opts = answerOptions || {};
      const raw = String(query || "").trim();
      const text = raw.toLowerCase();
      const mode = classifyQuery(raw, opts.mode);
      const last = opts.last || null;

      if (!raw) return missAnswer(mode);
      if (privacyCheck(raw)) return privacyAnswer(mode);

      if (text.length < 25 && /^(hi|hello|hey|hola|yo|sup|namaste|vanakkam)\b/.test(text)) {
        return {
          kind: "hi",
          text: ["Hey! I'm a local retrieval bot over Roshan's public notes. Ask about projects, how he learns, what he's preparing for, or switch modes for technical, personal, interview, or learning answers. Sensitive memories are not in this public build."],
          next: defaultChips.slice(0, 3),
          mode: mode
        };
      }

      if (text.length < 25 && /^(thanks|thank you|thx|ty|cool|nice|great|awesome|ok|okay|wow)\b/.test(text)) {
        return {
          kind: "thx",
          text: ["Anytime. Want the projects, or how I learn?"],
          next: ["What have you built?", "How do you learn?"],
          mode: mode
        };
      }

      if (/\b(what do you keep private|what is private|privacy|public notes|sensitive)\b/.test(text)) {
        return hit(["public_boundary"], mode) || privacyAnswer(mode);
      }

      if (
        (/\b(favorite|favourite)\b/.test(text) && /\b(movie|film|show|series|tv|singer|song|music|band|game|book|anime|actor|director|genre)\b/.test(text)) ||
        /\bwhat (music|movies|films|shows|games|books) do you (like|enjoy|watch|play|read)\b/.test(text) ||
        /\bwhich (singer|actor|director|band|game|book|movie|film|show)\b/.test(text)
      ) {
        return hit(["unknown_prefs"], mode) || missAnswer(mode);
      }

      if (/\b(who is roshan professionally|professional profile|professional summary|what does roshan do professionally)\b/.test(text)) {
        return hit(["about", "roles"], mode) || aboutAnswer(mode);
      }

      if (/\bwhat do you do( for a living| professionally)?[?.!]*$|\bwhat('s| is) your (work|job|role)\b/.test(text)) {
        return hit(["about", "roles"], mode) || aboutAnswer(mode);
      }

      if (/\bwhat are you (working on|doing|up to)\b|\bwhat('s| is) roshan (working on|doing|up to)\b|\bwhat('s| is) (new|up)\b/.test(text)) {
        return hit(["now", "vdart"], mode) || aboutAnswer(mode);
      }

      if (/\b(who('s| is) roshan|about roshan|tell me about (yourself|roshan)|introduce (yourself|roshan)|describe (yourself|roshan)|what('s| is) roshan like|your (background|bio|profile|introduction)|who am i talking to|what('s| is) your name)\b/.test(text)) {
        return aboutAnswer(mode);
      }

      if (/^(roshan( b)?|about|intro|introduction|background|profile|bio|summary)[?.!]*$/.test(text)) {
        return aboutAnswer(mode);
      }

      if (/\bwho are you\b|\bwhat are you\b[?.!]*$|\bare you (a |an )?(bot|ai|human|real|roshan)\b/.test(text)) {
        return hit(["bot", "about"], mode) || aboutAnswer(mode);
      }

      if (/\b(goals? and trade-?offs?|trade-?offs? and goals?)\b/.test(text)) {
        return hit(["now", "career_tradeoffs"], mode) || missAnswer(mode);
      }

      if (/\b(what|which) personal experiences\b|\bpersonal experiences are documented\b|\bwhat personal context\b/.test(text)) {
        return hit(["career_tradeoffs", "public_boundary"], mode) || missAnswer(mode);
      }

      if (/\b(evidence status|what is known|what's known|known vs inferred|inferred vs confirmed|outdated|conflicting|conflicting facts|facts conflict|memories disagree|two memories|what is unknown|which information is known|what information is known)\b/.test(text)) {
        return hit(["evidence_status"], mode) || missAnswer(mode);
      }

      if (/\bbm25\b/.test(text)) {
        return hit(["bm25"], mode) || missAnswer(mode);
      }

      if (/\bwhat (is|are) (roshan|he|you) studying\b|\bwhat are you (studying|majoring in)\b|\bwhere do you (study|go to college)\b|\bwhat('s| is) your (degree|major)\b/.test(text)) {
        return hit(["edu"], mode) || missAnswer(mode);
      }

      if (/\bwhat (has|have) (he|you|roshan) (actually )?(built|made)\b|\bbuilt and contributed\b|\bwhat did (he|you|roshan) (build|make)\b/.test(text)) {
        return hit(["projects"], mode) || missAnswer(mode);
      }

      if (/\b(which|what) projects (has|have|did|do) (he|you|roshan) (worked on|built|made)\b|\bwhat have you (built|made|worked on)\b|\bwhat has (he|roshan) (built|made)\b|\bprojects overview\b|\blist (your|his) projects\b/.test(text)) {
        return hit(["projects"], mode) || missAnswer(mode);
      }

      if (/\btell me about your (work|job|experience)\b|\byour work experience\b/.test(text)) {
        return hit(["vdart", "work"], mode) || missAnswer(mode);
      }

      if (/\bmentor(ing|ship)?\b|\bteach(ing)? interns\b/.test(text)) {
        return hit(["mentor"], mode) || missAnswer(mode);
      }

      if (mode === "interview" && /\b(interview|mock|ask me|practice|start|question)\b/.test(text)) {
        const item = nextInterviewQuestion();
        const note = byId.get(item.id);
        if (note) {
          return {
            kind: "interview",
            text: [
              "Interview question: " + item.q,
              "A grounded answer should use the " + note.title + " note. Cover the problem, your contribution, the trade-off, evidence, and one limitation. I can expand that note if you want."
            ],
            sources: [note],
            next: ["Tell me about " + note.title, "What would you change?"],
            sec: note.sec,
            mode: "interview"
          };
        }
      }

      const follow = followUpAnswer(raw, last, mode);
      if (follow) return follow;

      const hits = retrieve(raw, mode);
      if (/\broshan\b/.test(text) && (!hits.length || hits[0].score < 1.6)) return aboutAnswer(mode);
      if (!hits.length || hits[0].score < 1.6) return missAnswer(mode);

      const top = hits[0];
      const picks = [top];
      const second = hits[1];
      const relatedSecond = second && (
        second.n.category === top.n.category ||
        second.n.retrieval_tags.some(function (tag) { return top.n.retrieval_tags.includes(tag); })
      );
      if (second && relatedSecond && second.score >= top.score * 0.85 && second.score >= 1.6 && top.n.sec !== "contact") picks.push(second);

      const result = {
        kind: "hit",
        text: picks.map(function (pick) { return pick.n.text; }),
        sources: picks.map(function (pick) { return pick.n; }),
        next: top.n.next,
        sec: top.n.sec,
        mode: mode
      };

      if (mode === "interview") {
        result.text.push(INTERVIEW_FOLLOW_UPS[top.n.id] || "Follow-up: which part of that answer is evidence, and which part is still a limitation?");
      }

      return result;
    }

    return {
      version: kb.version || "2.0.0",
      updatedAt: kb.updated_at || "",
      notes: entries,
      defaultChips: defaultChips,
      modes: Object.keys(MODE_CATEGORIES),
      modeLabels: MODE_LABELS,
      classify: classifyQuery,
      privacyCheck: privacyCheck,
      evidenceLabel: evidenceLabel,
      retrieve: retrieve,
      answer: answer,
      get: function (id) { return byId.get(id); }
    };
  }

  return {
    create: create,
    classifyQuery: classifyQuery,
    privacyCheck: privacyCheck,
    evidenceLabel: evidenceLabel,
    modes: Object.keys(MODE_CATEGORIES),
    modeLabels: MODE_LABELS
  };
});
