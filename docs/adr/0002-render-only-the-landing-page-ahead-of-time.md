# Render only the landing page ahead of time

Prerender only the landing page at `/`; render `/buscar` and future application routes on the client as SPA views. The landing page benefits from indexable initial HTML, while the interactive search depends on browser state and API calls and does not need server rendering.
