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
    val guestsCount: Int = 0
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
    val aiScore: Int = 0
)

data class FaceMatch(
    val photo: Photo,
    val matchScore: Int = 95,
    val confidence: String = "High",
    val tags: List<String> = emptyList()
)
