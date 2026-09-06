from provider.core.errors import ConflictError, NotFoundError, ValidationError


class NoFaceDetected(ValidationError):
    code = "biometric_no_face"
    message = "No face was detected in the image."


class LivenessCheckFailed(ValidationError):
    code = "biometric_liveness_failed"
    message = "The face did not pass the liveness check."


class EnrollmentUserNotFound(NotFoundError):
    code = "enrollment_user_not_found"
    message = "No user exists with that id."


class FaceAlreadyEnrolled(ConflictError):
    code = "biometric_face_already_enrolled"
    message = "This face is already enrolled under a different account."
