// ============================================================
// FAKE REVIEW DETECTION MODULE
// Rule-based NLP: tokenisation, stop word removal,
// sentiment analysis, duplicate detection, keyword matching
// ============================================================

const Sentiment = require('sentiment');
const sentimentAnalyzer = new Sentiment();

// ── STOP WORDS ───────────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for',
  'of','with','by','from','is','was','are','were','be','been',
  'have','has','had','do','does','did','will','would','could',
  'should','may','might','this','that','these','those','i',
  'me','my','we','our','you','your','he','his','she','her',
  'it','its','they','their','what','which','who','there','here',
  'very','just','really','so','too','also','as','if','then',
  'than','not','no','only','about','up','out','over','more',
  'some','can','get','got','been','into','before','after'
]);

// ── FAKE REVIEW SIGNAL KEYWORDS ──────────────────────────────
const FAKE_SIGNALS = {
  excessive_praise: [
    'best ever','greatest','absolutely perfect','life changing','life-changing',
    'never been happier','beyond amazing','incredible','unbelievable','mind blowing',
    'mind-blowing','exceeded all expectations','without a doubt the best',
    '10 out of 10','100%','five stars','perfect product'
  ],
  promotional_language: [
    'buy now','order today','click here','visit our','check out our',
    'discount code','promo code','special offer','limited time','act now',
    'dont miss','do not miss','free shipping','money back guarantee',
    'try it now','get yours','affordable price','best price','cheapest'
  ],
  suspicious_patterns: [
    'i received this product for free','complimentary product','in exchange for review',
    'sent to me free','free product','i was given','they sent me','brand ambassador',
    'paid partnership','sponsored','gifted','#ad','not disappointed'
  ],
  generic_filler: [
    'great product','works as expected','does what it says','happy with purchase',
    'highly recommend','would recommend','good quality','love it','nice product',
    'worth the money','value for money','exactly as described'
  ],
  spam_indicators: [
    'http','www.','@gmail','@yahoo','contact us','call us','whatsapp',
    'telegram','instagram','facebook','follow us','subscribe'
  ]
};

// ── TOKENISER ─────────────────────────────────────────────────
function tokenise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// ── REMOVE STOP WORDS ─────────────────────────────────────────
function removeStopWords(tokens) {
  return tokens.filter(t => !STOP_WORDS.has(t));
}

// ── COMPUTE TERM FREQUENCY ────────────────────────────────────
function termFrequency(tokens) {
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  return freq;
}

// ── COSINE SIMILARITY (for duplicate detection) ───────────────
function cosineSimilarity(tokensA, tokensB) {
  const freqA = termFrequency(tokensA);
  const freqB = termFrequency(tokensB);
  const vocab = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);

  let dot = 0, magA = 0, magB = 0;
  vocab.forEach(term => {
    const a = freqA[term] || 0;
    const b = freqB[term] || 0;
    dot  += a * b;
    magA += a * a;
    magB += b * b;
  });

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── KEYWORD MATCHING ──────────────────────────────────────────
function matchKeywords(text) {
  const lower = text.toLowerCase();
  const hits = {};
  let totalHits = 0;

  Object.entries(FAKE_SIGNALS).forEach(([category, keywords]) => {
    const matched = keywords.filter(kw => lower.includes(kw));
    if (matched.length) {
      hits[category] = matched;
      totalHits += matched.length;
    }
  });

  return { hits, totalHits };
}

// ── SENTIMENT ANALYSIS ────────────────────────────────────────
function analyseSentiment(text) {
  const result = sentimentAnalyzer.analyze(text);
  const { score, comparative, positive, negative } = result;

  let label = 'neutral';
  let suspicionBoost = 0;

  if (comparative > 3)  { label = 'extremely_positive'; suspicionBoost = 25; }
  else if (comparative > 1)  { label = 'positive';           suspicionBoost = 5;  }
  else if (comparative < -1) { label = 'negative';           suspicionBoost = 10; }
  else if (comparative < -3) { label = 'extremely_negative'; suspicionBoost = 20; }

  return { score, comparative, label, positive, negative, suspicionBoost };
}

// ── STRUCTURAL CHECKS ─────────────────────────────────────────
function structuralChecks(text, rating) {
  const flags = [];
  let penalty = 0;

  // Excessive caps
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.3 && text.length > 20) { flags.push('excessive_caps'); penalty += 10; }

  // Too short
  if (text.trim().split(/\s+/).length < 5) { flags.push('too_short'); penalty += 15; }

  // Too long / suspiciously long
  if (text.trim().split(/\s+/).length > 300) { flags.push('suspiciously_long'); penalty += 10; }

  // Excessive punctuation
  const punctRatio = (text.match(/[!?]{2,}/g) || []).length;
  if (punctRatio > 2) { flags.push('excessive_punctuation'); penalty += 10; }

  // Rating vs sentiment mismatch
  return { flags, penalty };
}

// ── REPETITION CHECK ──────────────────────────────────────────
function repetitionCheck(tokens) {
  const freq = termFrequency(removeStopWords(tokens));
  const total = tokens.length || 1;
  const maxRepeat = Math.max(...Object.values(freq));
  const repetitionRatio = maxRepeat / total;

  let penalty = 0;
  if (repetitionRatio > 0.15) penalty += 15;
  if (repetitionRatio > 0.25) penalty += 15;

  return { repetitionRatio: +repetitionRatio.toFixed(3), penalty };
}

// ── DUPLICATE DETECTION (against existing reviews) ────────────
function detectDuplicates(newTokens, existingReviews) {
  const newFiltered = removeStopWords(newTokens);
  let maxSim = 0;
  let duplicateOf = null;

  existingReviews.forEach(rev => {
    const existingTokens = removeStopWords(tokenise(rev.text || ''));
    const sim = cosineSimilarity(newFiltered, existingTokens);
    if (sim > maxSim) {
      maxSim = sim;
      if (sim > 0.7) duplicateOf = rev._id || rev.id;
    }
  });

  let penalty = 0;
  if (maxSim > 0.9) penalty = 40;
  else if (maxSim > 0.7) penalty = 25;
  else if (maxSim > 0.5) penalty = 10;

  return { maxSimilarity: +maxSim.toFixed(3), duplicateOf, penalty };
}

// ── MAIN DETECTION ENGINE ─────────────────────────────────────
function analyseReview(reviewText, rating, existingReviews = []) {
  const tokens      = tokenise(reviewText);
  const filtered    = removeStopWords(tokens);
  const sentiment   = analyseSentiment(reviewText);
  const keywords    = matchKeywords(reviewText);
  const structural  = structuralChecks(reviewText, rating);
  const repetition  = repetitionCheck(tokens);
  const duplicates  = detectDuplicates(tokens, existingReviews);

  // ── SCORE CALCULATION ─────────────────────────────────────
  let score = 0;

  // Keyword hits
  score += keywords.totalHits * 8;

  // Sentiment extremity
  score += sentiment.suspicionBoost;

  // Structural issues
  score += structural.penalty;

  // Repetition
  score += repetition.penalty;

  // Duplicate
  score += duplicates.penalty;

  // Rating extremity bonus (1 or 5 star reviews are more suspect)
  if (rating === 5 || rating === 1) score += 5;

  // Cap at 100
  score = Math.min(score, 100);

  // ── VERDICT ───────────────────────────────────────────────
  let verdict, action;
  if (score >= 70) {
    verdict = 'HIGHLY_SUSPICIOUS';
    action  = 'AUTO_DELETE';
  } else if (score >= 40) {
    verdict = 'SUSPICIOUS';
    action  = 'SEND_TO_ADMIN';
  } else if (score >= 20) {
    verdict = 'MILDLY_SUSPICIOUS';
    action  = 'FLAG';
  } else {
    verdict = 'LEGITIMATE';
    action  = 'APPROVE';
  }

  return {
    score,
    verdict,
    action,
    details: {
      tokenCount:       tokens.length,
      filteredTokens:   filtered.length,
      sentiment,
      keywordHits:      keywords.hits,
      keywordHitCount:  keywords.totalHits,
      structuralFlags:  structural.flags,
      repetitionRatio:  repetition.repetitionRatio,
      duplicateSimilarity: duplicates.maxSimilarity,
      duplicateOf:      duplicates.duplicateOf,
    }
  };
}

module.exports = { analyseReview, tokenise, removeStopWords, cosineSimilarity };
