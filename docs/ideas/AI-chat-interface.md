# AI Pet Care Chat Feature Design Prompt

> **Important:** Follow the attached **Brainstorming** skill exactly. This feature request must be executed within that workflow, and the workflow's rules take precedence over any default implementation behavior.

## Objective

I want to design and eventually implement an **AI Chat** feature for this mobile application.

The feature is a cross-cutting system spanning both the **mobile application** and the **backend**.

The AI assistant acts as an intelligent **Pet Care Companion**.

It should:

- Answer only pet-related questions.
- Understand the user's pets and use their profiles as context.
- Understand the user's existing pet tasks whenever they are relevant.
- Combine:
  - the user's prompt,
  - pet information,
  - task information,
  - and other application context
  to generate an LLM response.

The conversation should be presented in a modern chat interface.

---

# How to Work

## 1. Follow the Brainstorming Skill

Use the Brainstorming skill throughout the entire discovery process.

In particular:

- Explore the existing project first.
- Do **not** write code.
- Do **not** create scaffolding.
- Do **not** start implementation.
- Do **not** invoke implementation-related skills.

Instead, remain entirely inside the brainstorming and design workflow until a complete specification has been produced and approved.

---

## 2. During Project Understanding

Before asking questions or proposing implementation:

- Study the current architecture.
- Explore the backend.
- Explore the mobile application.
- Review documentation.
- Review existing APIs.
- Review data models.
- Review authentication.
- Review current AI-related infrastructure (if any).

Then identify everything that is missing to support this feature.

Produce a report describing:

- existing architecture relevant to the feature
- missing infrastructure
- missing backend services
- missing mobile components
- missing APIs
- missing data models
- architectural weaknesses
- scalability concerns
- privacy concerns
- security concerns
- deployment concerns
- anything that should exist before implementation begins

Challenge assumptions instead of accepting them.

---

## 3. Requirements Discovery

Assume the requirements below are incomplete.

Your primary objective is to eliminate ambiguity before any implementation planning begins.

Think through every aspect of the system, including edge cases and long-term maintainability.

Ask **one question at a time**, following the Brainstorming skill, until you are confident that a complete Product Requirements Document (PRD) can be written.

Do not stop early.

Cover topics including (but not limited to):

- UX
- conversation lifecycle
- chat history
- prompt construction
- context retrieval
- task integration
- pet profile integration
- API design
- backend architecture
- mobile architecture
- LLM selection
- model routing
- streaming responses
- rate limiting
- token budgeting
- cost control
- safety
- moderation
- authentication
- authorization
- offline behavior
- synchronization
- caching
- analytics
- observability
- logging
- testing
- localization
- accessibility
- GDPR/privacy
- performance
- deployment
- future extensibility
- failure scenarios
- edge cases

Whenever you identify an unstated assumption, ask about it instead of making a decision yourself.

---

## 4. PRD

Only after all questions have been answered should you produce a comprehensive PRD.

The PRD should include:

- Goals
- Non-goals
- Functional requirements
- Non-functional requirements
- UX requirements
- User journeys
- Backend architecture
- Mobile architecture
- API specification
- Database changes
- LLM integration strategy
- Prompt engineering strategy
- Context retrieval strategy
- Conversation lifecycle
- Error handling
- Security model
- Privacy model
- Performance requirements
- Testing strategy
- Deployment considerations
- Risks
- Trade-offs
- Future enhancements

The PRD should be sufficiently detailed that another engineer could implement the feature without requiring additional clarification.

---

## Final Constraints

- Follow the Brainstorming skill exactly.
- Stay in design mode until the user approves the specification.
- Never begin implementation before the Brainstorming workflow reaches its implementation handoff.
- Prefer scalable, production-ready architecture over quick solutions.
- Explicitly identify missing project foundations before proposing implementation details.
