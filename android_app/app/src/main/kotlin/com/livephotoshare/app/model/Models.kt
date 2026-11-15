package com.livephotoshare.app.model

data class Event(
    val id: String = "",
    val code: String = "",
    val name: String = "",
    val description: String = "",
    val date: String = "",
    val location: String = "",
    val coverUrl: String = "",
    val photosCount: Int = 0,
    val guestsCount: Int = 0,
    val pin: String = ""
)

data class Photo(
    val id: String = "",
    val name: String = "",
    val url: String = "",
    val thumbnailUrl: String = "",
    val guestName: String = "Guest",
    val caption: String = "",
    val likes: Int = 0,
    val createdAt: String = "",
    val aiScore: Int = 0,
    val qualityScore: Int = 85,
    val isCulled: Boolean = false,
    val cullStatus: String = "approved",
    val highlightScore: Int = 85
)

data class FaceMatch(
    val photo: Photo,
    val matchScore: Int = 95,
    val confidence: String = "High",
    val tags: List<String> = emptyList()
)

data class WatermarkConfig(
    val enabled: Boolean = true,
    val logoPath: String = "/signature-marvan-logo.png",
    val position: String = "bottom-center",
    val scale: Float = 0.22f,
    val opacity: Float = 0.88f
)
