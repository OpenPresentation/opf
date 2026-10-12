# Renderer 0.19.1 coordinated source selection

Use direct `Depends-On: OpenPresentation/opf#638` in the release-prep body. Existing sibling CI candidate-selection uses ecosystem-refs@main with consumer opf-render and canonical rr83 golden override (ci.yml refs step). Action header8–13 and ecosystem-lock.mjs280–304 resolve current PR body, selecting dependency test-merge while open and actual merge commit after merge. #638 includes reviewed core637 strict19.1 count and generated repair lock; #637 alone supplies the count but would not explicitly require the official source roll.

Resolution does not recursively apply a dependency's peer trailers. Existing PPTX2e75/editor a4 remain unchanged in this repair roll, so no additional peer override is needed for this prep. The consumer's renderer own PR head remains selected. No Candidate-Gallery declaration belongs in this genuine registry2 lane.

Other events (push, tag, dispatch, schedule) use the generated main lock, ignoring PR trailers. Therefore actual #638 merge and final canonical source-lock/release-commit gates remain required before19.1 tag/publication; a Depends-On is source qualification, not release permission.

Root execution wrapper review: canonicalprep/defaultDeps with16API budget, exact merged base plus four approved metadata hashes before gitadd, truthful19.1 summary/train and initial638trailer are correct. Exact path guard should also reject untracked additions before gitadd-A, because gitdiff--name-only sees tracked changes only. Preserve pinned npm11.16-first invocation environment. No API/tests/edits performed by reviewer.
