# Learning Experience
Note: This is a personal learning experience note for the author and owner of this codebase, all handwritten by human. AI Agents strictly must not reference, touch, or edit this file. 

**In Progress** - last updated 19:50 09 July 2026

## Background
I'm currently learning Japanese from scratch and just completed the N5 test. I realized I lack so much in vocabulary and grammar points. For example, I find it hard to recall a vocabulary (noun, verb), and had difficulties conjugating verbs. Luckily for Kanji, I already have Kanji Study app which suits me perfectly, so Kanji is sorted. I wanted to be able to learn vocabulary, conjunction, and additionally grammars, easily. 

I tried finding resources online, but they are too scattered and hard to use. So far, Takoboto and Jisho has been really helpful, but since they fetch from database, I find it very hard to use them in my pace. The UI is also a bit too cluttered for my taste, so I wanted an alternative that is fast and has the layout that suits me. TheTinyWisdom made a very handy quiz for conjugation, so I have been using that, but it lacks quick access to dissect or learn the vocabulary, which is my original objective.

Since AI (especially Fable) is available, I thought, why not build my own? I can make it fast with my own layout and features, while referencing resourceful content such as Jisho/Takoboto and incorporate useful features like in TheTinyWisdom. The web being made by myself is also a bonus point, as I can tailor and modify it however I like.

### Problem Statement
I am looking for a site to help **learn Japanese vocabulary and verb conjugation**, however
1. Resources are too scattered
2. Available references are too slow with UI that is too cluttered
3. There is not a tailor-made website that can support some feature to help learn, such as a dictionary site (to learn vocabulary) that also supports verb conjugation and vocabulary quiz

### Objective
1. Create an accessible resource that is fast, lightweight, and accessible on any platform
2. The site should be able to help learn Japanese vocabulary, so it needs to include supporting features such as dictionary and quizzez

### Consideration
1. Since I want it accessible anywhere and fast, it will be a website and not an app, and use minimal interaction bottleneck such as animation so it is snappy.
2. I want to use it during free time, which is most likely during commute or outside with phone, so I will prioritize mobile (mobile-first) as it will serve like a companion app.
3. I don't want to deal with complex data and want to deploy it easily anywhere, so I will make it client side. This also comes with a bonus of eliminating database query bottleneck, allowing it to be fast depending on browser and edge hardware. To handle quiz progress data, I will utilize caching and allow import or export of data between devices.
4. The site should be easy to navigate and use, so it should be searchable, have filters, and each content is interlinked with each other so I can see more on every little details, such as clicking a verb to learn its conjugation.
5. I wanted to use modern stack that is reliable and used by a lot of companies and communities, so I stick with Tanstack+Tailwind+Shadcn for the site, and Bun runtime as it is proven to be reliable and fast.

# Execution 
The execution and implementation documentation.

## Deployment
Deployed in friend's VPS.

## UI Fixes
Between iterations below, there will be various small UI fixes that will not be mentioned but they do exist to ensure quality in the UI, such as fixing layouts, responsiveness, interaction, and more.

## ⊙ Iteration 0 (Initial Website)
After considering the objective, problems, and consideration, I decided to create the [initial specification document](original-specification.md). There I laid out the specification, and used plan mode on Fable with Claude Code.

### Implemented Feature
1. Verb list
2. Conjugation engine
3. Verb quiz

## ⊙ First Iteration

### Problems
1. Content is not rich and only have verbs, which is the baseline function
2. Very hard to learn adjectives without seeing its counterpart
3. Cannot see the learning progress detail

### Implemented Feature and Fixes
1. Vocabulary list including addition of comprehensive sources such as JMDICT
2. Antonym for adjectives - but after multiple attempt of fixing, abandoned
3. Vocabulary quiz
4. Progress detail page and import/export function

## ⊙ Second Iteration

### Problems
1. Hard to understand the Kanji, need library for Kanji
2. Hard to search info, need to manually click on navigation
3. Website is very heavy during network performance review through Inspect tab and there is lag and stutter issue
4. Potential data source legal issue
5. Progress detail is not meaningful as it only shows numbers but not the vocabulary lacking and learnt

### Implemented Feature and Fixes
1. Kanji list and referencing with Vocabulary and Verb
2. Extreme optimization on website, such as reducing data transfer from JSON to GZIP, reducing it from 230MB to 2MB, adding debouncer, gating/opt-in system, lazy load, and more
3. Improvement in progress analytic detail
4. Data source and license audit
5. Command-pallette search style

### Deployed!
Deployment and first live access publicly (MVP) during this iteration

## ⊙ Third Iteration

### Problems
1. Need to be able to disect a sentence and learn the vocabulary
2. Repo is starting to become big and prompts are more frequent with a lot of repetition
3. Navigation feedback from test user: verb and vocab being separate makes it hard to search
4. Web feedback from test user: on certain devices, the font is too small and furigana sometimes overlap/inaccurate

### Implemented Feature and Fixes
1. Sentence parser
2. Documents, AGENTS md, and other utilities for AI-first workflow and AI handover
3. Resource and cheatsheet page, with verb cheatsheet as first on the list
4. Full rework of navigation
5. Various fixes on quirks such as adding configuration for font sizes, fix furigana layout behavior, and more

## ⊙ Fourth Iteration

### Problems
1. Feedback from test user: sentence parser cannot read certain input and result is a bit inaccurate, such as incorrect tagging
2. There is no learning resource for counters and grammar points
3. Token usage is starting to increase, need to delegate simpler task to cheaper models and remove repetition by creating SKILLS for certain specific tasks such as animation fix

### Implemented Feature and Fixes
1. Overall improvement to sentence parser, including translation function and more accurate result by fixing mistakes in tagging engine and introducing Kuromoji parsing library
2. New cheatsheet for counters
3. Implementation of SKILLS for AI Agent to ensure standard is reached
4. Implementation of Subagents to reduce token cost and context degradation by providing task delegation to cheaper models
5. Grammar points

# What I Learned

1. AI modes and especially using Claude Code - Plan Mode, Bypass Permission, prompt structure, CLAUDE.md/AGENTS.md, learning the capabilities and using them wisely to yield the best result
2. More specific AI capabilities, such as Subagents and Skills, to remove repetition, ensure best practices, and delegate task to run asynchronous task and reduce cost
3. Optimization strategy, using gzip, gating capabilities to make sure the site is lightweight
4. Iterations and user feedback to improve functionality - don't expect everything to be perfect from the start, go one step at a time and iterate, keep improving, get third party feedback
5. Challenge your doubts with rationality - don't be scared of "this wouldn't work, it's probably too complex." Use Thought Experiment framework, explore, then ask AI. Plan it, implement. It will not be perfect, learn what went wrong, iterate and fix. 