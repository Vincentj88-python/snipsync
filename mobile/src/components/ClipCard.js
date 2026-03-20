import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { TYPE_STYLES } from '../theme/colors'
import { timeAgo, formatFileSize, getFileIcon } from '../lib/utils'
import { colors } from '../theme/colors'

export default function ClipCard({ clip, onDelete, onPin }) {
  const [copied, setCopied] = useState(false)
  const typeStyle = TYPE_STYLES[clip.type] || TYPE_STYLES.other
  const deviceName = clip.devices?.name || 'Unknown'
  const isLink = clip.type === 'link'
  const isFile = clip.type === 'file'
  const isImage = clip.type === 'image'

  const handleCopy = () => {
    Clipboard.setString(clip.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenLink = () => {
    if (isLink && clip.content) {
      const url = clip.content.startsWith('http') ? clip.content : `https://${clip.content}`
      Linking.openURL(url).catch(() => {})
    }
  }

  return (
    <View style={[styles.card, { borderLeftColor: typeStyle.border }]}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: typeStyle.bg }]}>
          <View style={[styles.dot, { backgroundColor: typeStyle.dot }]} />
          <Text style={[styles.badgeText, { color: typeStyle.text }]}>{clip.type}</Text>
        </View>

        {clip.pinned && <Text style={styles.pin}>📌</Text>}

        <Text style={styles.time}>{timeAgo(clip.created_at)}</Text>
        <Text style={styles.device}>{deviceName}</Text>
      </View>

      {/* Content */}
      {isFile ? (
        <View style={styles.fileRow}>
          <Text style={styles.fileIcon}>{getFileIcon(clip.content)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={1}>{clip.content}</Text>
            <Text style={styles.fileSize}>{formatFileSize(clip.image_size)}</Text>
          </View>
        </View>
      ) : isImage ? (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>🖼 Image clip</Text>
        </View>
      ) : (
        <Text
          style={[styles.content, isLink && styles.contentLink]}
          numberOfLines={4}
          onPress={isLink ? handleOpenLink : undefined}
        >
          {clip.content}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} activeOpacity={0.7}>
          <Text style={[styles.actionText, copied && styles.actionTextGreen]}>
            {copied ? '✓ Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onPin?.(clip.id, !clip.pinned)} activeOpacity={0.7}>
          <Text style={styles.actionText}>{clip.pinned ? 'Unpin' : 'Pin'}</Text>
        </TouchableOpacity>

        {isLink && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleOpenLink} activeOpacity={0.7}>
            <Text style={styles.actionText}>Open ↗</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete?.(clip.id)} activeOpacity={0.7}>
          <Text style={styles.actionTextDelete}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pin: {
    fontSize: 10,
  },
  time: {
    fontSize: 10,
    color: colors.textDim,
    marginLeft: 'auto',
  },
  device: {
    fontSize: 10,
    color: colors.textDim,
  },
  content: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginBottom: 8,
  },
  contentLink: {
    color: '#4ade80',
    textDecorationLine: 'underline',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0e1012',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fileIcon: {
    fontSize: 22,
  },
  fileName: {
    fontSize: 12,
    color: colors.text,
  },
  fileSize: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
  imagePlaceholder: {
    backgroundColor: '#0e1012',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: colors.textDim,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionTextGreen: {
    color: colors.green,
  },
  actionTextDelete: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
})
