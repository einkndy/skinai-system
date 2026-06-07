import json
import os
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras import layers, models
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.applications.efficientnet import preprocess_input
from tensorflow.keras.callbacks import (
    CSVLogger,
    EarlyStopping,
    ModelCheckpoint,
    ReduceLROnPlateau,
)


DATASET_PATH = Path("dataset_v2_bersih")
MODEL_DIR = Path("model")

CLASS_NAMES = [
    "flek_hitam",
    "jerawat",
    "kerutan",
    "komedo",
    "pori_pori_besar",
]

IMG_SIZE = (224, 224)
BATCH_SIZE = 16
EPOCHS = 50
RANDOM_STATE = 42
AUTOTUNE = tf.data.AUTOTUNE

FINAL_MODEL_PATH = MODEL_DIR / "condition_model_v1.keras"
BEST_MODEL_PATH = MODEL_DIR / "condition_best.keras"
CLASS_INDICES_PATH = MODEL_DIR / "condition_class_indices.json"
HISTORY_CSV_PATH = MODEL_DIR / "condition_history.csv"
CLASSIFICATION_REPORT_PATH = MODEL_DIR / "condition_classification_report.txt"
CONFUSION_MATRIX_PATH = MODEL_DIR / "condition_confusion_matrix.png"


def collect_dataset(dataset_path):
    image_paths = []
    labels = []

    for class_index, class_name in enumerate(CLASS_NAMES):
        class_dir = dataset_path / class_name

        if not class_dir.exists():
            raise FileNotFoundError(f"Folder kelas tidak ditemukan: {class_dir}")

        for image_path in sorted(class_dir.iterdir()):
            if image_path.is_file():
                image_paths.append(str(image_path))
                labels.append(class_index)

    if not image_paths:
        raise ValueError("Dataset kosong. Tidak ada gambar yang ditemukan.")

    return np.array(image_paths), np.array(labels, dtype=np.int32)


def stratified_split(image_paths, labels):
    train_paths, temp_paths, train_labels, temp_labels = train_test_split(
        image_paths,
        labels,
        test_size=0.30,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    val_paths, test_paths, val_labels, test_labels = train_test_split(
        temp_paths,
        temp_labels,
        test_size=0.50,
        random_state=RANDOM_STATE,
        stratify=temp_labels,
    )

    return train_paths, val_paths, test_paths, train_labels, val_labels, test_labels


def load_image(image_path, label):
    image = tf.io.read_file(image_path)
    image = tf.image.decode_image(image, channels=3, expand_animations=False)
    image = tf.image.resize(image, IMG_SIZE)
    image = tf.cast(image, tf.float32)
    image = preprocess_input(image)

    return image, tf.one_hot(label, depth=len(CLASS_NAMES))


def make_dataset(image_paths, labels, shuffle=False):
    dataset = tf.data.Dataset.from_tensor_slices((image_paths, labels))

    if shuffle:
        dataset = dataset.shuffle(
            buffer_size=len(image_paths),
            seed=RANDOM_STATE,
            reshuffle_each_iteration=True,
        )

    return (
        dataset
        .map(load_image, num_parallel_calls=AUTOTUNE)
        .batch(BATCH_SIZE)
        .prefetch(AUTOTUNE)
    )


def build_model():
    inputs = layers.Input(shape=(224, 224, 3))

    augmentation = models.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.05),
            layers.RandomZoom(0.08),
            layers.RandomContrast(0.10),
        ],
        name="condition_augmentation",
    )

    base_model = EfficientNetB0(
        weights="imagenet",
        include_top=False,
        input_shape=(224, 224, 3),
    )
    base_model.trainable = False

    x = augmentation(inputs)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D(name="global_average_pooling")(x)
    x = layers.Dropout(0.4, name="dropout")(x)
    outputs = layers.Dense(
        len(CLASS_NAMES),
        activation="softmax",
        name="condition_output",
    )(x)

    model = models.Model(inputs, outputs, name="skin_condition_efficientnetb0")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def plot_confusion_matrix(matrix, class_names, output_path):
    fig, ax = plt.subplots(figsize=(9, 8))
    image = ax.imshow(matrix, interpolation="nearest", cmap=plt.cm.Blues)
    fig.colorbar(image, ax=ax)

    ax.set(
        xticks=np.arange(len(class_names)),
        yticks=np.arange(len(class_names)),
        xticklabels=class_names,
        yticklabels=class_names,
        ylabel="True Label",
        xlabel="Predicted Label",
        title="Skin Condition Confusion Matrix",
    )

    plt.setp(ax.get_xticklabels(), rotation=35, ha="right", rotation_mode="anchor")

    threshold = matrix.max() / 2 if matrix.size else 0

    for row in range(matrix.shape[0]):
        for col in range(matrix.shape[1]):
            ax.text(
                col,
                row,
                format(matrix[row, col], "d"),
                ha="center",
                va="center",
                color="white" if matrix[row, col] > threshold else "black",
            )

    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def save_class_indices():
    class_indices = {
        class_name: index
        for index, class_name in enumerate(CLASS_NAMES)
    }

    CLASS_INDICES_PATH.write_text(
        json.dumps(class_indices, indent=2),
        encoding="utf-8",
    )

    return class_indices


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    image_paths, labels = collect_dataset(DATASET_PATH)

    (
        train_paths,
        val_paths,
        test_paths,
        train_labels,
        val_labels,
        test_labels,
    ) = stratified_split(image_paths, labels)

    train_ds = make_dataset(train_paths, train_labels, shuffle=True)
    val_ds = make_dataset(val_paths, val_labels)
    test_ds = make_dataset(test_paths, test_labels)

    class_weights = compute_class_weight(
        class_weight="balanced",
        classes=np.arange(len(CLASS_NAMES)),
        y=train_labels,
    )
    class_weight_map = {
        index: float(weight)
        for index, weight in enumerate(class_weights)
    }

    save_class_indices()

    model = build_model()
    model.summary()

    callbacks = [
        EarlyStopping(
            monitor="val_loss",
            patience=8,
            restore_best_weights=True,
        ),
        ModelCheckpoint(
            filepath=str(BEST_MODEL_PATH),
            monitor="val_loss",
            save_best_only=True,
        ),
        ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.3,
            patience=3,
            min_lr=1e-6,
        ),
        CSVLogger(str(HISTORY_CSV_PATH)),
    ]

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS,
        callbacks=callbacks,
        class_weight=class_weight_map,
    )

    test_loss, test_accuracy = model.evaluate(test_ds)
    print(f"TEST LOSS: {test_loss:.4f}")
    print(f"TEST ACCURACY: {test_accuracy:.4f}")

    y_prob = model.predict(test_ds)
    y_pred = np.argmax(y_prob, axis=1)
    y_true = test_labels

    report = classification_report(
        y_true,
        y_pred,
        target_names=CLASS_NAMES,
    )
    print(report)

    CLASSIFICATION_REPORT_PATH.write_text(report, encoding="utf-8")

    matrix = confusion_matrix(y_true, y_pred)
    plot_confusion_matrix(
        matrix,
        CLASS_NAMES,
        CONFUSION_MATRIX_PATH,
    )

    model.save(FINAL_MODEL_PATH)

    print("TRAINING SELESAI")
    print(f"Final model: {FINAL_MODEL_PATH}")
    print(f"Best model: {BEST_MODEL_PATH}")
    print(f"Class indices: {CLASS_INDICES_PATH}")
    print(f"History CSV: {HISTORY_CSV_PATH}")
    print(f"Classification report: {CLASSIFICATION_REPORT_PATH}")
    print(f"Confusion matrix: {CONFUSION_MATRIX_PATH}")

    return history


if __name__ == "__main__":
    main()
