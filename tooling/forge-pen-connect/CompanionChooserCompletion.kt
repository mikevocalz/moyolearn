package com.margelo.nitro.forgebluetooth.ble

/** Main-owner completion policy shared by the two independent public OS routes. */
internal class CompanionChooserCompletion {
  var settled = false
    private set
  var source: String? = null
    private set
  var resultCode: Int? = null
    private set

  fun complete(source: String, resultCode: Int?, verifyAndPublish: () -> String): String? {
    if (settled) return null
    val result = verifyAndPublish()
    this.source = source
    this.resultCode = resultCode
    settled = true
    return result
  }

  fun cancel(): Boolean {
    if (settled) return false
    settled = true
    return true
  }
}
