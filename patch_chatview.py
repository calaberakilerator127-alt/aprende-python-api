import re
import sys

path = r'c:\Users\Calaveroli127\Downloads\Aprende Python\src\views\ChatView.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
found = False
for line in lines:
    if 'Live session' in line and '{language ===' in line:
        indent = line[:line.find('{')]
        line = indent + """{(() => {
                                  const isPrivate = activeChat.type === 'private';
                                  const otherUser = isPrivate ? users.find(u => u.id === activeChat.otherUserId) : null;
                                  const isOnline = !isPrivate || otherUser?.status === 'online';
                                  return isPrivate ? (
                                    isOnline ? (language === 'es' ? 'En línea' : 'Online') : (
                                      otherUser?.lastSeen 
                                        ? `${language === 'es' ? 'Últ. vez:' : 'Last seen:'} ${new Date(otherUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        : (language === 'es' ? 'Desconectado' : 'Offline')
                                    )
                                  ) : (language === 'es' ? 'Sesión en vivo' : 'Live session');
                                })()}\n"""
        found = True
    new_lines.append(line)

if found:
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully patched ChatView.jsx")
else:
    print("Could not find the target line in ChatView.jsx")
