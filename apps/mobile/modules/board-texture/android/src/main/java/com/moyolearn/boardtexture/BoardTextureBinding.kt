package com.moyolearn.boardtexture

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * The answer to one bind attempt.
 *
 * `bound: false` is a presentation fact, not an error: the scene keeps drawing
 * the board as a raster with live polylines over it, which is what it did before
 * this module existed. `reason` is for the log and for the next person — it is
 * never shown to a child.
 * SOT: packages/ui/xr/BoardTextureHost.types.ts
 * SOT-KEYWORDS: board texture binding record bound reason event payload
 */
class BoardTextureBinding(
  @Field val bound: Boolean,
  @Field val reason: String?,
) : Record
