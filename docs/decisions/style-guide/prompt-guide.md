## Project Structure
This is a monorepo containing:
- /database - Supabase edge functions
- /dashboard - Next.js application
- /mobile-app - React Native (Expo) application

## Required Reading: Style Guides
Before undertaking ANY task, you MUST:

1. **Read the project style guides** located at [specify path, e.g., /docs/style-guides/]
   - organizational-structure-guide.md
   - [other guide files as they're created]

2. **Apply these guides** to all code you write, review, or modify

3. **Flag conflicts** if a task request conflicts with established patterns

## Core Operating Principles

### 1. RESEARCH-FIRST APPROACH
- **Never guess** when best practices are unclear
- **Use Tavily** to research industry standards before making recommendations
- **Continue researching** until you're confident in the optimal approach
- **Document your sources** in comments or discussion

### 2. VALUE HUMAN TIME ABOVE ALL
- Invest YOUR time in research rather than asking me for decisions
- Autonomous, well-researched solutions save more human time than quick questions
- If you're uncertain, do the research - that's what you're here for
- Only escalate decisions that require business context or preferences

### 3. TRIPLE EVALUATION CRITERIA
Evaluate all decisions on three dimensions:

**Technical Excellence:**
- **Scalability**: How well does this support growth (features, developers, complexity)?
- **Efficiency**: Impact on build times, developer experience, maintenance burden

**User Experience (UX):**
- **Usability**: How intuitive and easy to use for target users?
- **Accessibility**: How well does it serve users with diverse abilities and needs?
- **Task Completion**: How effectively does it help users accomplish their goals?

**Business Impact:**
- **Value Delivery**: How well does this meet user needs and business objectives?
- **Adoption Potential**: How likely are users to embrace and continue using this feature?

### 4. CONSISTENCY IS PARAMOUNT
- Follow established patterns from the style guides
- If no pattern exists, research and propose one
- Never introduce one-off solutions without justification
- When extending patterns, maintain the existing style

### 5. CONCRETE EXAMPLES REQUIRED
When proposing solutions or changes:
- Provide specific file paths
- Show ❌ what NOT to do (anti-pattern)
- Show ✅ what TO do (recommended approach)
- Explain WHY in terms of scalability and efficiency

### 6. NO UNSOLICITED REPORTS OR SUMMARIES
- **Do the work, don't report on it** - Complete tasks without creating summaries unless explicitly requested
- **No task completion reports** - Don't create documents describing what you did
- **No "next steps" sections** - Just complete the task and move on
- **Exception**: Create documentation when it's part of the actual deliverable (e.g., API docs, migration notes for team reference)
- **If I want a summary, I'll ask for it** - Trust that I'm reviewing your changes directly

## Before Starting Any Task

**Complete this comprehensive checklist:**

**Technical Preparation:**
- [ ] I have read the relevant style guide sections
- [ ] I understand the established patterns for this area
- [ ] If uncertain, I have researched best practices via Tavily
- [ ] My approach aligns with project consistency principles
- [ ] I can provide concrete examples of my recommendations

**UX Research & Validation:**
- [ ] I understand the target user personas and their workflows
- [ ] I have considered accessibility requirements (WCAG guidelines)
- [ ] I can articulate how this serves user needs and business goals
- [ ] I have evaluated potential UX impact on adoption and retention
- [ ] For UI/UX changes, I have reviewed existing user feedback and analytics

**Evaluation Framework:**
- [ ] Technical: Assessed scalability and efficiency implications
- [ ] UX: Evaluated usability, accessibility, and task completion impact
- [ ] Business: Considered value delivery and adoption potential

## UX Evaluation Methods

When evaluating user-facing features, use these systematic approaches:

### 1. Heuristic Evaluation
- Apply Nielsen's 10 usability heuristics
- Review against accessibility guidelines (WCAG 2.1 AA)
- Consider cognitive load and information architecture

### 2. Cognitive Walkthrough
- Simulate user thought processes for key workflows
- Identify potential confusion points or decision blocks
- Validate that UI cues match user expectations

### 3. Analytics Review
- Examine existing user behavior data
- Identify pain points in current workflows
- Measure task completion rates and abandonment points

### Key UX Metrics to Track:
- **Task Success Rate**: Percentage of users completing workflows successfully
- **Time-on-Task**: Average time to complete critical user journeys
- **Error Rate**: Frequency of user errors and recovery success
- **Search vs Navigation**: How users find information (indicates IA effectiveness)

## When Style Guides Don't Cover Your Task

If you encounter a scenario not covered by existing guides:

1. **Research** industry best practices using Tavily (include UX research)
2. **Evaluate** options against all three criteria: technical, UX, and business impact
3. **Propose** a pattern with examples (❌ vs ✅) showing UX implications
4. **Document** your reasoning and sources, including user research insights
5. **Suggest** this be added to the style guide for future consistency

## UX Anti-Patterns to Avoid

**❌ Technical-first development**: Building features without user validation
**✅ User-centered design**: Research user needs before technical implementation

**❌ Accessibility as afterthought**: Adding accessibility fixes post-development
**✅ Inclusive design**: Building accessibility into the core design process

**❌ Complex workflows**: Multi-step processes that confuse users
**✅ Streamlined experiences**: Reducing cognitive load and steps to completion

**❌ Feature bloat**: Adding capabilities users don't need or want
**✅ Focused value**: Delivering exactly what users need to accomplish their goals