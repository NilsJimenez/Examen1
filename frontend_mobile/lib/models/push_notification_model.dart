class PushNotificationModel {
  final int id;
  final String title;
  final String body;
  final String category;
  final String targetRole;
  final String? reference;
  final DateTime timestamp;
  bool isRead;

  PushNotificationModel({
    required this.id,
    required this.title,
    required this.body,
    this.category = 'general',
    this.targetRole = 'TODOS',
    this.reference,
    required this.timestamp,
    this.isRead = false,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'body': body,
    'category': category,
    'targetRole': targetRole,
    'reference': reference,
    'timestamp': timestamp.toIso8601String(),
    'isRead': isRead,
  };

  factory PushNotificationModel.fromJson(Map<String, dynamic> json) {
    return PushNotificationModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title']?.toString() ?? 'FashionStore',
      body: json['body']?.toString() ?? '',
      category: json['category']?.toString() ?? 'general',
      targetRole: json['targetRole']?.toString() ?? 'TODOS',
      reference: json['reference']?.toString(),
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isRead: json['isRead'] == true,
    );
  }
}
