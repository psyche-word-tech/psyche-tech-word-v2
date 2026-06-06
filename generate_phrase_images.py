import asyncio
import os
from coze_coding_dev_sdk import ImageGenerationClient

# 12个名词短语及其描述
phrases = [
    (1, "the head", "A human head from side view, realistic style"),
    (2, "the brain", "A realistic human brain, side view, pinkish color"),
    (3, "a dream", "A dreamy cloud landscape with soft colors, fantasy style"),
    (4, "terrible nightmare", "A dark scary nightmare scene with monsters, horror style"),
    (5, "long hair", "Beautiful long flowing hair, wavy texture, portrait"),
    (6, "tight curl", "Tight curly hair texture, close-up view"),
    (7, "his skull", "Human skull side view, realistic bone structure"),
    (8, "her forehead", "Beautiful woman face showing forehead, elegant portrait"),
    (9, "my brow", "Human eyebrow and forehead detail, close-up"),
    (10, "two eyebrows", "Two human eyebrows, close-up view"),
    (11, "one eye", "Single human eye, detailed iris, close-up portrait"),
    (12, "one orbit", "Eye orbit socket in human skull, anatomical view"),
]

async def generate_images():
    client = ImageGenerationClient()

    os.makedirs("/workspace/projects/client/assets/phrase_images", exist_ok=True)

    results = []

    for id, phrase, prompt in phrases:
        print(f"Generating image for: {phrase}")
        try:
            response = await client.generate_async(prompt=prompt, size="2K")
            if response.success:
                url = response.image_urls[0]
                print(f"  Success: {url}")
                results.append((id, phrase, url))
            else:
                print(f"  Failed: {response.error_messages}")
                results.append((id, phrase, None))
        except Exception as e:
            print(f"  Error: {e}")
            results.append((id, phrase, None))

    # 输出结果
    print("\n=== 生成结果 ===")
    for id, phrase, url in results:
        status = "✅" if url else "❌"
        print(f"{status} {id}. {phrase}: {url or 'FAILED'}")

    return results

if __name__ == "__main__":
    asyncio.run(generate_images())
