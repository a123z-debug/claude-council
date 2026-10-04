export const meta = {
  name: 'claude-council',
  description: 'Council of independent Claude agents: parallel opinions, anonymized peer review, results handed to the chairman for synthesis',
  whenToUse: 'Invoked by the claude-council skill for general councils and the fixed Arabic legal trigger استدعِ مجلس النقض / مجلس النقض',
  phases: [
    { title: 'Opinions', detail: 'council members answer independently in parallel' },
    { title: 'Peer Review', detail: 'each member critiques and ranks the anonymized answers' },
  ],
}

// args may arrive as a parsed object, a JSON-encoded string, or a bare question string
let input = args
if (typeof input === 'string') {
  try { input = JSON.parse(input) } catch (e) { input = { question: input } }
}
if (!input || typeof input !== 'object' || Array.isArray(input)) {
  throw new Error('args must be {question, mode?, preset?, context?, members?} or a question string')
}
const question = input.question
if (!question || typeof question !== 'string') throw new Error('args.question (string) is required')
const mode = input.mode === 'quick' ? 'quick' : 'full'
const extraContext = input.context
  ? `\n\nADDITIONAL CONTEXT (from the user's session):\n${input.context}`
  : ''

const IDS = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
const MODELS = ['fable', 'opus', 'sonnet', 'haiku']

// NOTE (verified 2026-06-11): subagents cannot run Fable 5 — model:'fable' silently
// falls back to Opus 4.8 (confirmed via agent transcript model IDs). Defaults pin
// 'opus' so labels match reality; 'fable' stays accepted in MODELS for the day
// subagent support lands — flip the Architect/Skeptic back to it then.
const DEFAULT_MEMBERS = [
  {
    persona: 'The Architect',
    model: 'opus',
    brief: 'Systems design and long-term consequences: interfaces, data flow, coupling, scalability, maintainability, and how the solution evolves and survives changing requirements.',
  },
  {
    persona: 'The Skeptic',
    model: 'opus',
    brief: 'Adversarial review: question the premise of the question itself, surface risks, hidden costs, edge cases and failure modes, and identify the strongest alternative the asker has probably not considered. If the council is being asked the wrong question, say what the right question is.',
  },
  {
    persona: 'The Pragmatist',
    model: 'opus',
    brief: 'Shipping: the simplest thing that could possibly work, time-to-value, what to cut, where YAGNI applies, and the smallest first step that de-risks the rest. Concrete steps over abstractions.',
  },
  {
    persona: 'The Researcher',
    model: 'opus',
    brief: 'Evidence and prior art: established solutions, libraries, papers, and best practices that already address this. Verify what you cite (use web search when it helps) and name names: tools, versions, references.',
  },
]

const CASSATION_MEMBERS = [
  {
    persona: 'قاضي قبول الالتماس',
    model: 'opus',
    brief: 'ابدأ من بوابة القبول قبل موضوع الحق. افحص نهائية الحكم، سبب الالتماس الحصري، الميعاد، الصفة، حجية الحكم، وهل الوقائع والمستندات تحقق سبب إعادة النظر فعلاً. ارفض أي حجة موضوعية ممتازة إذا كانت لا تفتح باب الالتماس.',
  },
  {
    persona: 'محامي المحكمة الإدارية العليا',
    model: 'opus',
    brief: 'حلل بمنهج المحكمة الإدارية العليا والنقض: القاعدة النظامية الدقيقة، خطأ التطبيق أو التكييف أو التسبيب، معيار الرقابة، الأثر المنتج للخطأ، وهل يبقى الحكم قائماً على سبب مستقل آخر.',
  },
  {
    persona: 'خبير نظام خدمة الأفراد',
    model: 'opus',
    brief: 'تخصص في نظام خدمة الأفراد ولوائحه وقرارات مجلس الوزراء والأوامر والمراسيم والعلاوات والمكافآت. اضبط المادة ورقم القرار والتاريخ وحدود كل نص ولا تفترض جواز الجمع أو المنع دون سند.',
  },
  {
    persona: 'خبير الإثبات وإعادة النظر',
    model: 'opus',
    brief: 'ابنِ نظرية الإثبات: الورقة القاطعة، تاريخ ظهورها، سبب تعذر إبرازها قبل الحكم، الحيازة لدى الخصم، رابطة السببية مع النتيجة، وكيفية إثبات كل عنصر بمحرر أو قرينة نظامية.',
  },
  {
    persona: 'محامي الجهة الإدارية',
    model: 'opus',
    brief: 'مثّل الجهة الحكومية بأقوى صورة ممكنة. حاول إسقاط الالتماس شكلاً وموضوعاً: سبق طرح الحجة، عدم جدة الورقة، إمكان الحصول عليها سابقاً، فوات الميعاد، حجية الأمر المقضي، استقلال أسباب الحكم، وعدم استيفاء شروط الاستحقاق.',
  },
  {
    persona: 'فريق النقض الأحمر',
    model: 'opus',
    brief: 'Red-team قضائي صارم. اختبر كل حجة كما لو كنت دائرة تريد رفضها. حدد العيب القاتل، أسوأ تفسير محتمل، المستند المفقود الذي تنهار الحجة بدونه، ثم اقترح علاجاً إن أمكن.',
  },
  {
    persona: 'باحث أحكام الإدارية العليا والمبادئ',
    model: 'opus',
    brief: 'ابحث عن أحكام المحكمة الإدارية العليا والمبادئ القضائية والاتجاهات ذات الصلة. ميّز بين الحكم الملزم أو المبدأ المنشور وبين مجرد حكم مشابه، وحدد وجه التطابق والاختلاف بدقة.',
  },
  {
    persona: 'خبير حجية الأحكام والأمر المقضي',
    model: 'opus',
    brief: 'افحص نطاق الحجية: الخصوم، المحل، السبب، الفترات الزمنية، الأسباب المستقلة، وما إذا كانت المطالبة أو المستند الجديد يصطدم بحجية حكم نهائي أو يقع خارج نطاقها.',
  },
  {
    persona: 'خبير المواعيد والإجراءات أمام ديوان المظالم',
    model: 'opus',
    brief: 'راجع المواعيد، التبليغ، بدء الأجل، الاختصاص، المحكمة المختصة، متطلبات الصحيفة، التظلم السابق عند لزومه، وآثار أي خطأ إجرائي على قبول الالتماس أو الدعوى.',
  },
  {
    persona: 'خبير تدرج القواعد والنسخ والتعارض',
    model: 'opus',
    brief: 'رتب المرسوم والنظام واللائحة وقرار مجلس الوزراء والأمر السامي والقرارات التنفيذية زمنياً وموضوعياً. اختبر النسخ والتعديل والتخصيص والتعارض ولا تقبل استدلالاً بنص منسوخ أو خارج محله.',
  },
  {
    persona: 'خبير تفسير النصوص والقرارات التنظيمية',
    model: 'opus',
    brief: 'حلل دلالة الألفاظ والاستثناءات والشروط والقيود والإحالات والبنود الفرعية. فرّق بين النص المنشئ للاستحقاق، النص المحدد للسقف، والنص المانع من الجمع.',
  },
  {
    persona: 'خبير المسميات والتصنيف الوظيفي العسكري',
    model: 'opus',
    brief: 'افحص المسمى الوظيفي والتخصص والرمز والتصنيف والمعادلة بين المسميات العسكرية. لا تعتبر تشابه المهام بديلاً عن قرار اعتماد أو تصنيف إذا كان النص يشترط مسمى معتمداً.',
  },
  {
    persona: 'خبير العلاوات والبدلات والمكافآت العسكرية',
    model: 'opus',
    brief: 'حدد سبب كل ميزة مالية ووعاءها وشروطها والغرض الذي صرفت من أجله. اختبر اتحاد الغرض، الجواز أو المنع من الجمع، والفارق بين العلاوة والبدل والمكافأة في الحالة المحددة.',
  },
  {
    persona: 'خبير الوصف الوظيفي والتشكيلات والملاك',
    model: 'opus',
    brief: 'افحص الملاك والتشكيل التنظيمي وبطاقة الوصف وموقع الوظيفة الفعلي والقسم المعتمد. ميّز بين المثبت عليه الفرد ومكان تكليفه أو ممارسته، وحدد أثر ذلك على شروط الاستحقاق.',
  },
  {
    persona: 'خبير الشؤون المالية والرواتب والسقوف',
    model: 'opus',
    brief: 'دقق نسب البدلات والعلاوات والمكافآت ووعاء الاحتساب والسقف والاستثناءات والفترات. ارفض أي حسبة غير موثقة أو خلط بين أصل الاستحقاق وحد الصرف.',
  },
  {
    persona: 'خبير السجلات والمحررات الحكومية والإفصاح',
    model: 'opus',
    brief: 'حدد السجل أو الملف أو الجهة الحافظة للمستند المفقود، وكيفية طلبه وإثبات تعذر الوصول إليه، وما إذا كان تحت يد الخصم أو جهة عامة، مع مراعاة المستندات المصنفة أو السرية.',
  },
  {
    persona: 'خبير المستندات القاطعة والتعذر عن التقديم',
    model: 'opus',
    brief: 'اختبر هل الورقة جديدة حقاً، قاطعة حقاً، سابقة في وجودها للحكم أو لاحقة، وهل تعذر تقديمها قبل الحكم لسبب يمكن إثباته. ضع اختباراً ثنائياً: هل تغيّر سبباً مستقلاً؟ وهل تفتح باب الالتماس؟',
  },
  {
    persona: 'خبير الغش والتدليس والكتمان الإجرائي',
    model: 'opus',
    brief: 'لا يفترض الغش. يبحث عن فعل أو امتناع محدد من الخصم، علمه بالحقيقة، أثره في تكوين عقيدة المحكمة، وتوقيت اكتشافه. يرفض تحويل مجرد عدم تقديم مستند إلى تدليس بلا دليل.',
  },
  {
    persona: 'خبير السببية والأثر المنتج في الحكم',
    model: 'opus',
    brief: 'يسأل: لو صح هذا الخطأ أو ظهر هذا المستند، هل تتغير النتيجة فعلاً؟ افصل بين الخطأ غير المنتج والخطأ الذي يهدم ركناً ضرورياً، وافحص بقاء أسباب أخرى مستقلة للحكم.',
  },
  {
    persona: 'خبير تسبيب الأحكام والقصور والتناقض',
    model: 'opus',
    brief: 'يفكك أسباب الحكم سطراً بسطر: ما الوقائع التي ثبتت، ما الدفوع التي أجيب عنها أو أهملت، أين القصور أو التناقض أو فساد الاستدلال، وهل ذلك يصلح لسبب الالتماس أو فقط للطعن العادي.',
  },
  {
    persona: 'خبير المقارنة والتمييز بين الأحكام',
    model: 'opus',
    brief: 'يقارن الأحكام المقترحة من حيث الوقائع والمسمى والوظيفة والعلاوة والفترة والنص المطبق ودرجة المحكمة والمنطوق. يمنع الاستناد إلى سابقة تختلف في مناطها الجوهري.',
  },
  {
    persona: 'خبير صياغة اللوائح والطلبات القضائية',
    model: 'opus',
    brief: 'يحوّل الحجة المقبولة إلى صحيفة منضبطة: بيانات، وقائع، سبب الالتماس، المستندات، الأثر المنتج، والطلبات. يحذف المبالغات والعبارات التي تفتح دفوعاً مجانية للخصم.',
  },
  {
    persona: 'استراتيجي الدعوى والبدائل الإجرائية',
    model: 'opus',
    brief: 'يقارن بين الالتماس ودعوى حقوق لاحقة أو تظلم جديد أو طلب مستندات أو مسار آخر. يحدد ما يجب فعله أولاً وما لا ينبغي رفعه قبل اكتمال الدليل.',
  },
  {
    persona: 'مدقق الاستشهادات ومنع الهلوسة',
    model: 'opus',
    brief: 'يراجع كل رقم مادة وقرار وتاريخ واقتباس واسم حكم ومصدر. يضع علامة UNVERIFIED على أي سند غير مثبت، ويمنع بناء النتيجة على معلومة غير موثقة أو منقولة على نحو غير دقيق.',
  },
]

const CASSATION_REVIEW_BOARD_IDS = new Set(['A', 'B', 'E', 'F', 'G', 'Q', 'T', 'X'])

const CASSATION_TRIGGER = /(?:استدع[ِ]?\s*)?مجلس\s+النقض/u
const preset = input.preset === 'cassation' || CASSATION_TRIGGER.test(question)
  ? 'cassation'
  : 'default'

const rawMembers = Array.isArray(input.members) && input.members.length >= 2
  ? input.members
  : preset === 'cassation'
    ? CASSATION_MEMBERS
    : DEFAULT_MEMBERS
const members = rawMembers.slice(0, IDS.length).map((m, i) => ({
  id: IDS[i],
  persona: (m && m.persona) || `Member ${IDS[i]}`,
  model: m && MODELS.includes(m.model) ? m.model : 'opus',
  brief: (m && m.brief) || 'A thoughtful, independent expert perspective.',
}))

const presetGroundRules = preset === 'cassation'
  ? `\n- افصل صراحة بين: (أ) سبب قبول الالتماس، (ب) الحجج الموضوعية بعد القبول، (ج) المستندات التي ما زال يلزم استخراجها.
- لا تختلق نصاً أو حكماً أو تاريخاً أو واقعة. إذا لم تستطع التحقق من سند، صِفه بأنه غير متحقق.
- افحص ما إذا كان الحكم قائماً على أكثر من سبب مستقل، ولا تعتبر هدم سبب واحد كافياً إذا بقي سبب آخر حاملاً للمنطوق.
- تعامل مع ملفات القضية والمستندات الأصلية باعتبارها المصدر الأول للوقائع، ومع المصادر الرسمية باعتبارها المرجع الأول للنصوص.
- أعطِ أقوى حجة مضادة قبل توصيتك النهائية.`
  : ''

const OPINION_SCHEMA = {
  type: 'object',
  properties: {
    stance: { type: 'string', description: 'Your position in one sentence' },
    answer: { type: 'string', description: preset === 'cassation' ? 'Your focused legal analysis in markdown, under ~450 words' : 'Your full answer/recommendation in markdown, under ~600 words' },
    key_points: { type: 'array', items: { type: 'string' }, description: 'The 3-6 most important points' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['stance', 'answer', 'key_points', 'confidence'],
}

const opinionPrompt = (m) => `You are "${m.persona}", one of ${members.length} independent members of an advisory council. Every member answers the same question in isolation; your answer will later be critiqued and ranked anonymously by the other members, so make it count.

YOUR LENS: ${m.brief}

THE QUESTION:
${question}${extraContext}

Ground rules:
- You are running in the user's current project directory. If the question concerns this project or its code, investigate the relevant files with your tools before opining. If it is a general question, answer directly without exploring.
- Use web search only if current or external facts would materially improve the answer.
- Take a clear position with concrete recommendations. Hedged mush gets ranked last in peer review.
- Stay true to your lens, but do not be a caricature: if the evidence goes against your natural inclination, say so.${presetGroundRules}`

phase('Opinions')
log(`Convening council of ${members.length}: ${members.map((m) => m.persona).join(', ')} (mode: ${mode}, preset: ${preset})`)
const opinionResults = await parallel(members.map((m) => () =>
  agent(opinionPrompt(m), { label: m.persona, phase: 'Opinions', model: m.model, schema: OPINION_SCHEMA })
    .then((op) => (op ? { member: m, opinion: op } : null))
))
const seated = opinionResults.filter(Boolean)
if (seated.length === 0) throw new Error('No council member returned an opinion')
if (seated.length < members.length) {
  log(`${members.length - seated.length} member(s) failed to respond; proceeding with ${seated.length}`)
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    critiques: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          response_id: { type: 'string', description: 'The single-letter response ID, e.g. "A"' },
          strengths: { type: 'string' },
          weaknesses: { type: 'string' },
        },
        required: ['response_id', 'strengths', 'weaknesses'],
      },
    },
    ranking: { type: 'array', items: { type: 'string' }, description: 'All response IDs ordered best to worst, e.g. ["B","A","D","C"]' },
    best_overall_insight: { type: 'string', description: 'The single most valuable insight across all responses' },
  },
  required: ['critiques', 'ranking'],
}

let reviews = []
if (mode === 'full' && seated.length >= 2) {
  phase('Peer Review')
  const validIds = seated.map((s) => s.member.id)
  const packet = seated
    .map((s) => `### Response ${s.member.id}\n\nStance: ${s.opinion.stance}\n\n${s.opinion.answer}`)
    .join('\n\n---\n\n')
  const reviewPrompt = (m) => `You are "${m.persona}" serving as a peer reviewer on an advisory council. The council was asked:

${question}${extraContext}

Below are the ${seated.length} anonymized answers from the council. One of them may be your own — judge it as harshly as the rest.

${packet}

For EACH response, give concise strengths and weaknesses. Then rank ALL responses from best to worst by: correctness, legal support, insight density, actionability, and how well it answers the actual question (not how well it matches your own style). Use response_id values exactly from: ${validIds.join(', ')}. Judge only what is written — do not explore the filesystem or web.`

  const reviewPanel = preset === 'cassation'
    ? seated.filter((s) => CASSATION_REVIEW_BOARD_IDS.has(s.member.id))
    : seated

  log(`Peer review board: ${reviewPanel.length} reviewer(s) evaluating ${seated.length} independent opinions`)
  const reviewResults = await parallel(reviewPanel.map((s) => () =>
    agent(reviewPrompt(s.member), { label: `review by ${s.member.persona}`, phase: 'Peer Review', model: s.member.model, schema: REVIEW_SCHEMA })
      .then((rv) => (rv ? { reviewer: s.member.persona, reviewer_id: s.member.id, review: rv } : null))
  ))
  reviews = reviewResults.filter(Boolean)
  if (reviews.length === 0) log('Peer review round returned nothing; falling back to opinions only')
}

const validIdSet = new Set(seated.map((s) => s.member.id))
const normalizeId = (x) => {
  const cleaned = String(x).replace(/response/i, '').replace(/[^a-z]/gi, '').toUpperCase()
  return validIdSet.has(cleaned) ? cleaned : null
}
const rankSums = {}
const rankCounts = {}
for (const r of reviews) {
  const seen = new Set()
  const ranked = (r.review.ranking || [])
    .map(normalizeId)
    .filter((id) => id && !seen.has(id) && seen.add(id))
  ranked.forEach((id, pos) => {
    rankSums[id] = (rankSums[id] || 0) + pos + 1
    rankCounts[id] = (rankCounts[id] || 0) + 1
  })
}
const aggregate_ranking = [...validIdSet]
  .map((id) => ({
    id,
    persona: seated.find((s) => s.member.id === id).member.persona,
    average_rank: rankCounts[id] ? Math.round((rankSums[id] / rankCounts[id]) * 100) / 100 : null,
    times_ranked: rankCounts[id] || 0,
  }))
  .sort((a, b) => (a.average_rank == null ? 99 : a.average_rank) - (b.average_rank == null ? 99 : b.average_rank))

log('Council adjourned — handing results to the chairman')
return {
  question,
  mode,
  preset,
  members_failed: members.length - seated.length,
  review_board_size: reviews.length,
  council: seated.map((s) => ({
    id: s.member.id,
    persona: s.member.persona,
    model: s.member.model,
    stance: s.opinion.stance,
    confidence: s.opinion.confidence,
    key_points: s.opinion.key_points,
    answer: s.opinion.answer,
  })),
  peer_reviews: reviews,
  aggregate_ranking,
  synthesis_instructions: preset === 'cassation'
    ? 'Chairman: synthesize all 24 independent legal opinions plus the specialist review board. Separate admissibility from merits. Group findings by procedure, merits, evidence, opposition, and strategy. End with five explicit items: (1) admissibility gateway, (2) strongest merits attack, (3) strongest defense, (4) missing decisive evidence, (5) recommended next filing step. Include the verdict table and consensus/dissent per SKILL.md.'
    : 'Chairman (main session): de-anonymize, synthesize the final plan with inline attribution, include the council verdict table and consensus/dissent notes per SKILL.md Stage 3.',
}
