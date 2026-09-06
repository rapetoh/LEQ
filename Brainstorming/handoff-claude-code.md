# Handing this over to you

I'm coming from Claude chat, so in a sense you were there: we spent the last few weeks discussing this project together, and this folder is the result. I'm moving to you now because it's time to build.

The project is LEQ, a French mobile app that trains people in public speaking. It's built around Rebecca, a real coach whose criteria drive the feedback. The user speaks, the app analyses the recording, gives structured feedback, and moves them along a personalised path. There's a weekly public contest, private duels, and a paid real-time debate against an AI opponent. The app is entirely in French.

Everything we settled about the product is in this folder. The cahier des charges is the reference: it says what the app does, how it behaves, what stays out, and why. The diagrams cover the domain, the lifecycle of an attempt, and the main sequences. The HTML file is the validated design mockup, third version, reviewed by Rebecca. Where the mockup and the cahier des charges disagree, the cahier des charges wins. These documents are decisions, not suggestions, and the reasoning behind each one is written in them.

Everything about how this gets built is yours. Stack, architecture, project structure, build order, tooling, testing. I'm not going to hand you a plan, because I want you to own this end to end and be accountable for it the whole life of the project. Propose what needs proposing, decide what's yours to decide, and flag what genuinely needs me or Rebecca.

A few things you should know before you start.

Some inputs don't exist yet and the documents say so: Rebecca's evaluation grid, the rules for the path generator, the choice of speech-to-text provider, the measured cost of a debate session. Don't block on them and don't invent them. There's plenty that doesn't depend on any of it.

One working practice I keep on every project: a tracking docs folder in the repo, kept up to date as things change. State of the build, decisions made along the way, how to run things. The test is that a human or another AI picking this up cold, at any point, understands where things stand without asking anyone.

And one rule about writing that I don't want to revisit: every string in the app is plain, simple French, the kind real consumer apps ship. Buttons are verbs, messages are information. No cleverness, no aphorisms. The mockup was rewritten to that standard, hold it.

That's the whole picture. Tell me how you'd approach it and let's get started.
