name = input().rstrip("\n")
text = input()

if name:
    text = text.replace(name, "[username]")

print(text, end="")

