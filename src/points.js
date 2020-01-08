
export class Point {
  constructor(x, y) {
    if (typeof x === 'object') {
      this.x = x.x;
      this.y = x.y;
    } else {
      this.x = x;
      this.y = y;
    }
  }

  add(other) {
    return new Point(this.x + other.x, this.y + other.y);
  }

  sub(other) {
    return this.add(other.mul(-1));
  }

  mul(other) {
    return new Point(this.x * other, this.y * other);
  }

  div(other) {
    return this.mul(1 / other);
  }


  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  normal() {
    if (this.y === 0) return new Point(-this.y / this.x, 1).normalize();

    return new Point(1, -this.x / this.y).normalize();
  }

  normalize() {
    return this.div(this.length());
  }

  normalizeSquare() {
    return this.div(this.length() ** 2);
  }

  distanceToLine(a, b) {
    return Math.abs((b.y - a.y) * this.x - (b.x - a.x) * this.y + b.x * a.y - b.y * a.x) / a.sub(b).length();
  }

  dot(other) {
    return this.x * other.x + this.y * other.y;
  }
}

