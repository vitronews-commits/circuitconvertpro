<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

EasyEDA exports use a shared normalized-image-to-canvas transform for all detected objects and retain detected paths; legacy automatic layout is reserved for projects without source positions and per-net routing for missing paths, because electrical endpoints must stay aligned with the photographed schematic.

